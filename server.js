var express = require("express");
var method = require("method-override");
var mongoose = require("mongoose");
var request = require("request");
var cheerio = require("cheerio");
var exphbs = require("express-handlebars");
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

// Models
var Note = require("./models/Note");
var Article = require("./models/Article");
var databaseUrl = process.env.MONGODB_URI || 'mongodb://localhost/news-scraperdb';

var app = express();
var PORT = process.env.PORT || 3000;

// App
app.use(express.urlencoded({ extended: false }));
app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");
app.use(method("_method"));
app.use(express.static("public"));

//Mongoose
mongoose.set('useCreateIndex', true)
mongoose.connect(databaseUrl, { useNewUrlParser: true })
mongoose.Promise = Promise;
var db = mongoose.connection;
db.on("error", function (error) {
	console.log("Mongoose Error: ", error);
});
db.once("open", function () {
	console.log("Mongoose connection successful.");
});

// Start the server
app.listen(PORT, function () {
	console.log("App running on port " + PORT + "!");
});

// All routes

app.get("/", function (req, res) {
	Article.find({issaved:false}, null, { sort: { created: -1 } }, function (err, data) {
		if (data.length === 0) {
			res.render("placeholder", { message: "There's nothing scraped yet. Please click \"Scrape New Articles\" for articles." });
		}
		else {
			res.render("index", { articles: data });
		}
	});
});

app.get("/scrape", function (req, res) {
	request("https://www.nytimes.com/section/magazine", function (error, response, html) {
		var $ = cheerio.load(html);
		var result = {};
		// console.log("before loop")
		$("article").each(function (i, element) {
			var link = $(element).find("div").find("h2 a").attr("href");
			var title = $(element).find("div").find("h2 a").text().trim();
			var summary = $(element).find("div").find("p").text().trim();
			var img = $(element).find("figure a").find("img").attr("src");
			result.link = "https://www.nytimes.com/section/magazine" + link;
			result.title = title;
			if (summary) {

				result.summary = summary;
			} else {
				"There is no summary available for this article";
			};
			if (img) {
				result.img = img;
				// console.log("image");
			} else {
				result.img = $(element).find("figure a").find("img").attr("src");
			};

			console.log(result);
			var entry = new Article(result);
			Article.find({ title: result.title }, function (err, data) {
				if (data.length === 0) {
					entry.save(function (err, data) {
						if (err) throw err;
					});
				}
			});

		});
		console.log("Scrape finished.");
		res.redirect("/");
	});

	//Takes you to the list of all the saved article(s)
	app.get("/saved", function (req, res) {
		Article.find({ issaved: true }, null, { sort: { created: -1 } }, function (err, data) {
			if (data.length === 0) {
				res.render("placeholder", { message: "You have not saved any articles yet." });
			}
			else {
				res.render("saved", { saved: data });
			}
		});
	});

	app.get("/:id", function (req, res) {
		Article.findById(req.params.id, function (err, data) {
			res.json(data);
		})
	})


});

app.post("/save/:id", function (req, res) {
	Article.findById(req.params.id, function (err, data) {
		if (data.issaved) {
			Article.findByIdAndUpdate(req.params.id, { $set: { issaved: false, status: "Save Article" } }, { new: true }, function (err, data) {
				res.redirect("/");
			});
		}
		else {
			Article.findByIdAndUpdate(req.params.id, { $set: { issaved: true, status: "Saved" } }, { new: true }, function (err, data) {
				res.redirect("/");
			});
		}
	});
});

app.post("/note/:id", function (req, res) {
	// var note = new Note(req.body);
	Note.create(req.body).then(function (note) {
		
		Article.findByIdAndUpdate(req.params.id, { $set: { "note": note._id } }, { new: true })
		  .then(function(dbArticle) {
			// If we were able to successfully update an Article, send it back to the client
			res.json(dbArticle);
		  })
		  .catch(function(err) {
			// If an error occurred, send it to the client
			res.json(err);
		  });
	});
});

app.get("/note/:id", function (req, res) {
	var id = req.params.id;
	Article.findById(id).populate("note").exec(function (err, data) {
		res.send(data.note);
	})
})

