Router.configure({
	layoutTemplate: 'main',
	loadingTemplate: 'loading'
});

Todos = new Mongo.Collection('todos');
Lists = new Meteor.Collection('lists');


if (Meteor.isClient) {
	$.validator.setDefaults({
		rules: {
			email: {
				required: true,
				email: true
			},
			password: {
				required: true
				//, minlength: 6
			}
		},
		messages: {
			email: {
				required: "You must enter an email address.",
				email: "You've entered an invalid email address."
			},
			password: {
				required: "You must enter a password."
				//,minlength: "Your password must be at least {0} characters."
			}
		}
	});

	Template.todos.helpers({
		todo: function(){
			var currentList = this._id;
			var currentUser = Meteor.userId();
			return Todos.find({listId: currentList, createdBy:currentUser}, {sort: {createdAt: -1}});
		}
	});

	Template.addTodo.events({
		/// events go here
		'submit form': function(event) {
			event.preventDefault();
			var todoName = $('[name="todoName"]').val();
			var currentList = this._id;
			/*var currentUser = Meteor.userId();
			console.log("currentUser: " + currentUser);
			Todos.insert({
				name: todoName,
				complete: false,
				createdAt: new Date(),
				createdBy: currentUser,
				listId: currentList
			});*/
			Meteor.call('createListItem', currentList, todoName, function(error, results) {
				if (error) {
					console.log(error.reason);
				} else {
					//console.log("results: " + results);
					$('[name="todoName"]').val('');
				}
			})
		}
	});
	
	Template.todoItem.events({
		/// events go here
		'click .delete-todo': function(event) {
			event.preventDefault();
			var documentId = this._id;
			var confirm = window.confirm("Delete this task?");
			if (confirm) {
				//Todos.remove({_id: documentId});
				Meteor.call('removeListItem', documentId);
			}
		},
		'keyup [name=todoItem]': function(event) {
			if (event.which == 13 || event.which == 27) {
				$(event.target).blur();
			} else {
				var documentId = this._id;
				var todoItem = $(event.target).val();
				Meteor.call('updateListItem', documentId, todoItem);
				//Todos.update({_id:documentId}, {$set: {name:todoItem}});
			}
		},
		'change [type=checkbox]': function(event) {
			var documentId = this._id;
			var isCompleted = this.completed;
			Meteor.call('changeItemStatus', documentId, !isCompleted);
			//Todos.update({_id:documentId}, {$set: {completed: !isCompleted}});
		}
	});
	Template.todoItem.helpers({
		'checked': function() {
			return this.completed ? "checked" : "";
		}
	});

	Template.todosCount.helpers({
		'totalTodos': function() {
			var currentList = this._id;
			return Todos.find({listId: currentList}).count();
		},
		'completedTodos': function() {
			var currentList = this._id;
			return Todos.find({listId: currentList, completed:true}).count();
		}
	});

	Template.addList.events({
		'submit form': function(event) {
			event.preventDefault();
			var listName = $('[name=listName]').val();
			/*var currentUser = Meteor.userId();
			Lists.insert({
				name: listName,
				createdBy: currentUser
			}, function(error, results) {
				Router.go('listPage', {_id: results});
			});
			$('[name=listName]').val('');*/
			Meteor.call('createNewList', listName, function(error, results) {
				if (error) {
					console.log(error.reason);
				} else {
					Router.go('listPage', {_id: results});
					$('[name=listName]').val('');
				}
			});
		}
	});

	Template.lists.helpers({
		'list': function() {
			var currentUser = Meteor.userId();
			return Lists.find({createdBy:currentUser}, {sort: {name: 1}});
		}
	});
	Template.lists.onCreated(function() {
		this.subscribe('lists');
	});

	Template.register.events({
		'submit form': function(event) {
			event.preventDefault();
		}
	});
	Template.register.onRendered(function() {
		console.log("The 'register' template was just rendered.");
		var validator = $('.register').validate({
			submitHandler: function(event) {
				var email = $('[name=email]').val();
				var password = $('[name=password]').val();
				Accounts.createUser({
						email: email,
						password: password
					}, function(error) {
						if (error) {
							if (error.reason == "Email already exists.") {
								validator.showErrors({
									email: "That email already belongs to a registered user."
								});
							}
						} else {
							Router.go("home");
						}
					});
				Router.go('home');
			}
		});
	});

	Template.login.events({
		'submit form': function(event) {
			event.preventDefault();
		}
	});
	Template.login.onCreated(function() {
		//console.log("The 'login' template was just created.");
	});
	Template.login.onRendered(function() {
		var validator = $('.login').validate({
			submitHandler: function(event) {
				var email = $('[name=email]').val();
				var password = $('[name=password]').val();
				Meteor.loginWithPassword(email, password, function(error) {
					if (error) {
						if (error.reason == "User not found") {
							validator.showErrors({
								email: "That email doesn't belong to a registered user."
							});
						} else if (error.reason == "Incorrect password") {
							validator.showErrors({
								password: "You entered an incorrect password."
							});
						}
					} else {
						var currentRoute = Router.current().route.getName();
						if (currentRoute == "login") {
							Router.go("home");
						}
					}
				});
			}
		});
	});
	Template.login.onDestroyed(function() {
		//console.log("The 'login' template was just destroyed.");
	});

	Template.navigation.events({
		'click .logout': function(event) {
			event.preventDefault();
			Meteor.logout();
		}
	});

}

if (Meteor.isServer) {
	Meteor.publish('lists', function() {
		var currentUser = this.userId;
		return Lists.find({createdBy: currentUser});
	});
	Meteor.publish('todos', function(currentList) {
		var currentUser = this.userId;
		return Todos.find({ createdBy: currentUser, listId: currentList });
	});
	function defaultName(currentUser) {
		var nextLetter = 'A';
		var nextName = 'List ' + nextLetter;
		while (Lists.findOne({ name: nextName, createdBy: currentUser})) {
			nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
			nextName = 'List ' + nextLetter;
		}
		return nextName;
	}
	Meteor.methods({
		'createNewList': function(listName) {
			var currentUser = Meteor.userId();
			if (!currentUser) {
				throw new Meteor.Error("not-logged-in", "You're not logged in.");
			}

			check(listName, String);
			if (listName == "") {
				listName = defaultName(currentUser);
			}
			var data = {
				name: listName,
				createdBy: currentUser
			};
			return Lists.insert(data);
		},
		'createListItem': function(listName, item) {
			var currentUser = Meteor.userId();
			if (!currentUser) {
				throw new Meteor.Error("not-logged-in", "You're not logged in.");
			}
			check(listName, String);
			if (listName == "") {
				throw new Meteor.Error("empty-list-name", "You didn't provide a list name.");
			}
			check(item, String);
			if (item == "") {
				throw new Meteor.Error("empty-item-name", "You didn't provide an item name.");
			}
			var currentList = Lists.findOne(listName);
			if (!currentList) {
				throw new Meteor.Error("invalid-list", "List does not exist.");
			}
			if (currentList.createdBy != currentUser) {
				throw new Meteor.Error("invalid-user", "You don't own that list.");
			}
			var data = {
				name: item,
				complete: false,
				createdAt: new Date(),
				createdBy: currentUser,
				listId: listName
			};
			//console.log("data: " + data.name + ", " + data.complete + ", " + data.createdAt + ", " + data.createdBy + ", " + data.listId);
			return Todos.insert(data);
		},
		'updateListItem': function(documentId, itemName) {
			var currentUser = Meteor.userId();
			if (!currentUser) {
				throw new Meteor.Error("not-logged-in", "You're not logged in.");
			}
			check(documentId, String);
			if (documentId == "") {
				throw new Meteor.Error("empty-item-id", "You didn't provide a list name.");
			}
			check(itemName, String);
			if (itemName == "") {
				throw new Meteor.Error("empty-item-name", "You didn't provide an item name.");
			}
			var currentItem = Todos.findOne(documentId);
			if (!currentItem) {
				throw new Meteor.Error("invalid-todo", "Todo item does not exist.");
			}
			if (currentItem.createdBy != currentUser) {
				throw new Meteor.Error("invalid-user", "You don't own that todo item.");
			}
			return Todos.update({_id:documentId}, {$set: {name:itemName}});
		},
		'changeItemStatus': function(documentId, isCompleted) {
			var currentUser = Meteor.userId();
			if (!currentUser) {
				throw new Meteor.Error("not-logged-in", "You're not logged in.");
			}
			check(documentId, String);
			if (documentId == "") {
				throw new Meteor.Error("empty-item-id", "You didn't provide a list name.");
			}
			check(isCompleted, Boolean);
			var currentItem = Todos.findOne(documentId);
			if (!currentItem) {
				throw new Meteor.Error("invalid-todo", "Todo item does not exist.");
			}
			if (currentItem.createdBy != currentUser) {
				throw new Meteor.Error("invalid-user", "You don't own that todo item.");
			}
			return Todos.update({_id:documentId}, {$set: {completed: isCompleted}});
		},
		'removeListItem': function(documentId) {
			var currentUser = Meteor.userId();
			if (!currentUser) {
				throw new Meteor.Error("not-logged-in", "You're not logged in.");
			}
			check(documentId, String);
			if (documentId == "") {
				throw new Meteor.Error("empty-item-id", "You didn't provide a list name.");
			}
			var currentItem = Todos.findOne(documentId);
			if (!currentItem) {
				throw new Meteor.Error("invalid-todo", "Todo item does not exist.");
			}
			if (currentItem.createdBy != currentUser) {
				throw new Meteor.Error("invalid-user", "You don't own that todo item.");
			}
			return Todos.remove({_id: documentId});
		}
	});
}

Router.route('/register');
Router.route('/login');
Router.route('/', {
	name: 'home',
	template: 'home'
	/*,waitOn: function() {
		var currentList = this.params._id;
		return Meteor.subscribe('todos', currentList);
	}*/
});
Router.route('/list/:_id', {
	name: 'listPage',
	template: 'listPage',
	data: function() {
		var currentList = this.params._id;
		var currentUser = Meteor.userId();
		return Lists.findOne({_id: currentList, createdBy:currentUser});
	},
	onBeforeAction: function() {
		//console.log("You triggered 'onBeforeAction' for 'listPage' route.");
		var currentUser = Meteor.userId();
		if (currentUser) {
			this.next();
		} else {
			this.render("login");
		}
	},
	waitOn: function() {
		var currentList = this.params._id;
		//return [ Meteor.subscribe('lists'), Meteor.subscribe('todos', currentList)];
		return Meteor.subscribe('todos', currentList);
	}
});