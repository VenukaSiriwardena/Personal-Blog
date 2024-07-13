import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "blog",
  password: "Venuka5511",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Routes
app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.post("/signup", (req, res) => {
  const { fName, lName, email, New_password } = req.body;

  // Check if any field is missing
  if (!fName || !lName || !email || !New_password) {
    return res.render("home", { error: "All fields are required." });
  }

  // Check if the email already exists
  db.query("SELECT * FROM logindata WHERE email = $1", [email], (err, result) => {
    if (err) {
      console.error("Error checking for existing email", err);
      return res.status(500).send("Internal server error");
    }

    if (result.rows.length > 0) {
      // Email already exists, show an error message
      return res.render("home", { emailExists: true });
    } else {
      // Email does not exist, proceed to insert the new data
      db.query(
        "INSERT INTO logindata (f_name, l_name, email, user_password) VALUES ($1, $2, $3, $4)",
        [fName, lName, email, New_password],
        (err) => {
          if (err) {
            console.error("Error inserting data", err);
            return res.status(500).send("Error inserting data");
          } else {
            res.redirect("/signin");
          }
        }
      );
    }
  });
});

app.post("/signin", (req, res) => {
  const { email, password } = req.body;

  // Check if any field is missing
  if (!email || !password) {
    return res.render("SigninPage.ejs", { error: "All fields are required." });
  }

  db.query("SELECT * FROM logindata WHERE email = $1", [email], (err, result) => {
    if (err) {
      console.error("Error checking for existing email", err);
      return res.status(500).send("Internal server error");
    }

    if (result.rows.length > 0) {
      res.render("add_post.ejs");
    } else {
      // Email does not exist, show error message
      res.render("SigninPage.ejs", { error: "Email not found. Please sign up." });
    }
  });
});

app.get("/signin", (req, res) => {
  res.render("SigninPage.ejs", { error: "" });
});

app.get("/signup", (req, res) => {
  res.render("SignupPage.ejs", { error: "" });
});


app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});

app.get("/popular_post", (req, res) => {
  res.render("popular_post.ejs");
});

app.get("/categories", (req, res) => {
  res.render("categories.ejs");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
