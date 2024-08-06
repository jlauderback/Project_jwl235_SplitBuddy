const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const _ = require("lodash");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

mongoose.connect("mongodb+srv://jwl235:pnW7sEC2tg7lzVZ6@cluster0.gi5govy.mongodb.net/SplitBuddy");

app.set("view engine", "ejs");

const expenseSchema = {
  amount: Number,
  expenseName: String,
  category: String
};

const Expense = mongoose.model("Expense", expenseSchema);

const userSchema = {
  name: String,
  expenses: [expenseSchema]
};

const User = mongoose.model("User", userSchema);

const listSchema = {
  name: String,
  items: [expenseSchema]
};

const List = mongoose.model("List", listSchema);

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/expense-tracking", async function(req, res) {
  const category = req.query.category;
  const listName = _.capitalize(category);
  const foundList = await List.findOne({ name: listName });
  if (!foundList) {
    const list = new List({
      name: listName,
      items: []
    });
    await list.save();
    res.redirect("/expense-tracking?category=" + category);
  } else {
    res.render("expense-tracking", {listTitle: listName, newListItems: foundList.items, category: category});
  }
});

app.post("/expense-tracking", async function(req, res) {
  const expenseName = req.body.newItem;
  const expenseAmount = parseFloat(req.body.newPrice);
  const expenseCategory = req.body.newCategory;
  const listName = _.capitalize(expenseCategory);
  const expense = new Expense({
    expenseName: expenseName,
    amount: expenseAmount,
    category: expenseCategory
  });
  await expense.save();
  const foundList = await List.findOne({name: listName});
  if (foundList) {
    foundList.items.push(expense);
    await foundList.save();
  } else {
    const list = new List({
      name: listName,
      items: [expense]
    });
    await list.save();
  }
  res.redirect("/expense-tracking?category=" + expenseCategory);
});

app.post("/delete-expense", async function(req, res) {
  const itemId = req.body.itemId;
  const expenseCategory = req.body.newCategory;
  const listName = _.capitalize(expenseCategory);
  await List.findOneAndUpdate(
    {name: listName},
    { $pull:{items:{_id: itemId}}}
  );
  res.redirect("/expense-tracking?category=" + expenseCategory);
});

app.get("/bill-splitting", async function(req, res) {
  const categories = await List.find({}, 'name');
  const selectedCategory = req.query.category;
  let expenses = [];
  let selectedExpense = null;
  let users = [];
  if (selectedCategory) {
    const list = await List.findOne({ name: selectedCategory });
    if (list) {
      expenses = list.items;
      const expenseId = req.query.expenseId;
      if (expenseId) {
        selectedExpense = list.items.id(expenseId);
        if (selectedExpense) {
          users = await User.find({'expenses._id': expenseId}).populate('expenses');
        }
      }
    }
  }
  res.render("bill-splitting", {categories, selectedCategory, expenses, selectedExpense, users});
});

app.post("/add-user", async function(req, res) {
  const expenseId = req.body.expenseId;
  const userName = req.body.userName;
  const amount = parseFloat(req.body.amount);
  const category = req.body.category;
  const expense = await Expense.findById(expenseId);
  const expenseObject = {
    expenseName: expense.expenseName,
    category: category,
    amount: amount,
    _id: expense._id
  };
  let user = await User.findOne({ name: userName });
  if (user) {
    user.expenses.push(expenseObject);
    await user.save();
  } else {
    const newUser = new User({
      name: userName,
      expenses: [expenseObject]
    });
    await newUser.save();
  }
  res.redirect("/bill-splitting?category=" + category + "&expenseId=" + expenseId);
});

app.post("/remove-user", async function(req, res) {
  const expenseId = req.body.expenseId;
  const userId = req.body.userId;
  const category = req.body.category;
  await User.findByIdAndUpdate(userId, {$pull:{expenses:{_id: expenseId}}});
  res.redirect("/bill-splitting?category=" + category);
});

app.post("/save-split", async function(req, res) {
  const expenseId = req.body.expenseId;
  const users = req.body.users;
  const category = req.body.category;
  const expense = await Expense.findById(expenseId);
  await User.updateMany({'expenses._id': expenseId}, {$pull:{expenses:{_id: expenseId}}});
  for (const user of users) {
    const foundUser = await User.findOne({name: user.name});
    if (foundUser) {
      foundUser.expenses.push(expense);
      await foundUser.save();
    } else {
      const newUser = new User({
        name: user.name,
        expenses: [expense]
      });
      await newUser.save();
    }
  }
  return res.redirect("/bill-splitting?category=" + category);
});

app.get("/reports-analytics", async function(req, res) {
  const users = await User.find({}, "name");
  let selectedUser = null;
  let userExpenses = [];
  let totalAmount = 0;
  if (req.query.userName) {
    selectedUser = req.query.userName;
    const user = await User.findOne({name: selectedUser}).populate("expenses");
    if (user) {
      userExpenses = user.expenses;
      totalAmount = userExpenses.reduce((acc, expense) => acc + expense.amount, 0);
    }
  }
  res.render("reports-analytics", {
    users: users.map(function(user){return user.name;}),
    selectedUser: selectedUser,
    userExpenses: userExpenses,
    totalAmount: totalAmount
  });
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("server started")
});
