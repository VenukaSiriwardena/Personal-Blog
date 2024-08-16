import express from "express";
import bodyParser from "body-parser";
import bcrypt from 'bcrypt';
import passport from 'passport';
import { Strategy as LocalStrategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import flash from 'connect-flash';
import env from "dotenv";
import pool from "./db.js";  // Ensure this path is correct

const app = express();
const port = 3000;
env.config();

app.use(
  session({
    secret: "TOPSECRETWORD",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages = req.flash('error');
  res.locals.isAuthenticated = req.isAuthenticated(); // Add authentication status to locals
  next();
});

// Passport Local Strategy
passport.use(
  "local",
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const result = await pool.query("SELECT * FROM logindata WHERE email = $1", [email]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.user_password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return done(err);
          } else {
            if (valid) {
              return done(null, user);
            } else {
              return done(null, false, { message: 'Incorrect password.' });
            }
          }
        });
      } else {
        return done(null, false, { message: 'User not found.' });
      }
    } catch (err) {
      console.log(err);
      return done(err);
    }
  })
);

passport.use(
  'google',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/google/callback',
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        console.log(profile); // Log the profile to understand its structure

        const email = profile.emails[0].value;
        const result = await pool.query('SELECT * FROM logindata WHERE email = $1', [email]);

        if (result.rows.length === 0) {
          const newUser = await pool.query(
            'INSERT INTO logindata (email, password) VALUES ($1, $2) RETURNING *',
            [email, 'google']
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        console.error('Error during Google authentication:', err);
        return cb(err);
      }
    }
  )
);

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect to desired page
    res.redirect('/popular_post');
  }
);

passport.serializeUser((user, cb) => {
  cb(null, user.id); // Use user id instead of entire user object
});

passport.deserializeUser(async (id, cb) => {
  try {
    const result = await pool.query("SELECT * FROM logindata WHERE id = $1", [id]);
    if (result.rows.length > 0) {
      cb(null, result.rows[0]);
    } else {
      cb(new Error("User not found"));
    }
  } catch (err) {
    cb(err);
  }
});

// Middleware to ensure authentication
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Routes
app.get("/",(req, res) => {
  res.render('home.ejs');
});

app.post("/signup", async (req, res) => {
  const { fName, lName, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query("SELECT * FROM logindata WHERE email = $1", [email]);
    
    if (result.rows.length > 0) {
      // Email already exists, show error message
      req.flash('error', 'Email already exists');
    } else {
      // Insert new user into the database
      await pool.query(
        "INSERT INTO logindata (f_name, l_name, email, user_password) VALUES ($1, $2, $3, $4)",
        [fName, lName, email, hashedPassword]
      );
      // Successfully inserted, redirect to sign-in page
      req.flash('success', 'Account created successfully. Please sign in.');
      return res.redirect('/login');
    }
  } catch (err) {
    console.error("Error during sign-up process:", err);
    return res.status(500).send("Internal server error");
  }
});

app.get("/signup", (req, res) => {
  const error = req.flash('error');
  res.render("SignupPage.ejs", { error });
});

app.get("/login", (req, res) => {
  const success = req.flash('success');
  res.render("SigninPage.ejs", { success });
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});

app.get("/popular_post", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blog_posts');
    const posts = result.rows;
    res.render('Popular_post.ejs', { posts });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.get("/posts", ensureAuthenticated, (req, res) => {
  res.render("add_post.ejs");
});

app.post("/add_post", ensureAuthenticated, (req, res) => {
  const { title, content, description } = req.body;
  const userId = req.user.id;

  pool.query(
    "INSERT INTO blog_posts (title, content, user_id, description) VALUES ($1, $2, $3, $4)",
    [title, content, userId, description],
    (err, result) => {
      if (err) {
        console.error("Error inserting data into database:", err);
        res.status(500).send("Internal server error");
      } else {
        res.redirect('/popular_post');  // Changed from res.render to res.redirect
      }
    }
  );
});

app.get('/post/:id', async (req, res) => {
  const postId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT blog_posts.*, logindata.f_name, logindata.l_name 
       FROM blog_posts 
       JOIN logindata ON blog_posts.user_id = logindata.id 
       WHERE blog_posts.id = $1`, 
      [postId]
    );
    const post = result.rows[0];

    if (post) {
      res.render('post.ejs', { post });
    } else {
      res.status(404).send('Post not found');
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get('/profile', ensureAuthenticated, async (req, res) => {
  const profileId = req.user.id;  // Fetch the user ID from the authenticated session

  try {
    const result = await pool.query(
      `SELECT blog_posts.*, logindata.f_name, logindata.l_name 
       FROM blog_posts 
       JOIN logindata ON blog_posts.user_id = logindata.id 
       WHERE blog_posts.user_id = $1`, 
      [profileId]
    );
    const posts = result.rows;

    const userResult = await pool.query(
      `SELECT f_name, l_name, email 
       FROM logindata 
       WHERE id = $1`,
      [profileId]
    );
    const user = userResult.rows[0];

    if (posts.length > 0) {
      res.render('my_account.ejs', { user, posts });
    } else {
      res.render('my_account.ejs', { user, posts: [] });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.get('/edit_profile', ensureAuthenticated, (req, res) => {
  const user = req.user; // Get the authenticated user
  res.render('edit_profile.ejs', { user });
});

app.post('/edit_profile', ensureAuthenticated, async (req, res) => {
  const { fName, lName, email, password } = req.body;
  const userId = req.user.id;
  try {
    // Update user details without password
    let query = 'UPDATE logindata SET f_name = $1, l_name = $2, email = $3 WHERE id = $4';
    let values = [fName, lName, email, userId];

    // If password is provided, hash it and update as well
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = 'UPDATE logindata SET f_name = $1, l_name = $2, email = $3, user_password = $4 WHERE id = $5';
      values = [fName, lName, email, hashedPassword, userId];
    }

    await pool.query(query, values);
    req.flash('success', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Failed to update profile');
    res.redirect('/edit_profile');
  }
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
