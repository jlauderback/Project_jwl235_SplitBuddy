const express = require ("express");
const bodyParser = require ("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const _ = require("lodash");

const app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

mongoose.connect("mongodb+srv://jwl235:pnW7sEC2tg7lzVZ6@cluster0.gi5govy.mongodb.net/SplitBuddy");

app.set("view engine", "ejs");

const userSchema = {
  name: String,
  amount: Number
};

const itemsSchema = {
  name: String,
  price: Number,
  users: [userSchema]
};

const Item = mongoose.model(
  "Item",
  itemsSchema
);

const item1 = new Item ({
  name: "Expense 1",
  price: "0.00"
});

const item2 = new Item ({
  name: "Expense 2",
  price: "0.00"
});

const item3 = new Item ({
  name: "Expense 3",
  price: "0.00"
});

const defaultItems = [item1, item2, item3];

const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model(
  "List",
  listSchema
);

app.get("/expense-tracking", async function(req, res){
  const category = req.query.category;
  const listName = _.capitalize(category);
  const foundList = await List.findOne({name: listName});
  if (!foundList) {
    const list = new List({
      name: listName,
      items: defaultItems
    });
    await list.save();
    res.redirect("/expense-tracking" + category);
  } else {
    res.render("expense-tracking", {listTitle: listName, newListItems: foundList.items, category: category});
  }
});

app.post("/expense-tracking", async function(req, res){
  const itemName = req.body.newItem;
  const itemPrice = req.body.newPrice;
  const itemCategory = req.body.newCategory;
  const listName = _.capitalize(itemCategory);
  const item = new Item({
    name: itemName,
    price: itemPrice
  });
  const foundList = await List.findOne({name: listName});
  if (foundList) {
    foundList.items.push(item);
    await foundList.save();
    res.redirect("/expense-tracking" + itemCategory);
  } else {
    const list = new List({
      name: listName,
      items: [item]
    });
    await list.save();
    res.redirect("/expense-tracking" + itemCategory);
  }
});

app.post("/delete-expense", async function(req, res){
  const itemId = req.body.itemId;
  const itemCategory = req.body.newCategory;
  const listName = _.capitalize(itemCategory);
  await List.findOneAndUpdate(
    {name: listName},
    {$pull:{items:{_id: itemId}}}
  );
  res.redirect("/expense-tracking" + itemCategory);
});

app.get("/bill-splitting", async function(req, res) {
  const categories = await List.find({}, 'name');
  const selectedCategory = req.query.category;
  if (selectedCategory) {
    const list = await List.findOne({name: selectedCategory});
    expenses = list.items;
    const expenseId = req.query.expenseId;
    selectedExpense = list.items.id(expenseId);
  }
  res.render("bill-splitting", {categories, selectedCategory, expenses, selectedExpense});
});

app.post("/add-user", async function(req, res) {
  const expenseId = req.body.expenseId;
  const userName = req.body.userName;
  const amount = req.body.amount;
  const category = req.body.category;
  const listName = _.capitalize(category);
  const list = await List.findOne({name: listName});
  if (list) {
    const expense = list.items.id(expenseId);
    if (expense) {
      expense.users.push({name: userName, amount: parseFloat(amount)});
      await list.save();
    }
  }
  res.redirect("/bill-splitting" + category + "expenseId" + expenseId);
});

app.post("/remove-user", async function(req, res) {
  const expenseId = req.body.expenseId;
  const userId = req.body.userId;
  const category = req.body.category;
  const listName = _.capitalize(category);
  const list = await List.findOne({name: listName});
  if (list) {
    const expense = list.items.id(expenseId);
    if (expense) {
      expense.users.id(userId).remove();
      await list.save();
    }
  }
  res.redirect("/bill-splitting" + category + "expenseId" + expenseId);
});

app.post("/save-split", async function(req, res) {
  const expenseId = req.body.expenseId;
  const users = req.body.users;
  const expense = await Item.findById(expenseId);
  const totalAmount = expense.price;
  const userAmounts = users.map(user => parseFloat(user.amount));
  expense.users = users.map(user => ({name: user.name, amount: parseFloat(user.amount)}));
  await expense.save();
  res.redirect("/bill-splitting" + expenseId);
});

let port = process.env.PORT;
if (port == null || port == ""){
  port = 3000;
}
app.listen(port, function(){
  console.log("server started")
});
