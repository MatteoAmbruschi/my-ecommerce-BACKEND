if(process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./queries');
const session = require("express-session");
const passport = require('passport');
const LocalStrategy = require("passport-local").Strategy;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

// CORS Configuration
const origin = [
  'http://localhost:3001',
  'http://localhost:3001/',
  'http://localhost:3000',
  'http://localhost:3000/',
  'http://localhost:5173/',
  'http://localhost:5173',
  'https://my-ecommerce-backend-rb50.onrender.com',
  'https://my-ecommerce-frontend-chi.vercel.app',
  'https://my-ecommerce-frontend-chi.vercel.app/',
  'https://my-ecommerce-backend-rb50.onrender.com/cart',
  'https://my-ecommerce-qq7y.onrender.com',
  'https://my-ecommerce-qq7y.onrender.com/',
  'https://my-ecommerce-backend.vercel.app',
  'https://my-ecommerce-backend.vercel.app/',
  'https://my-ecommerce-backend-f0kqy66v8-matteos-projects-aeb1c80b.vercel.app/'
]

const corsOptions = {
  origin,
  optionsSuccessStatus: 200,
  credentials: true
}

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: false,
    secure: false, // Disattivare solo in ambiente di sviluppo!
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Cookie Parser
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Passport Local Strategy
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  function (email, password, done) {
    db.findByEmail(email, function (err, user) {
      if (err) {
        return done(err);
      }
      if (!user) {
        return done(null, false, { message: 'Email address not found' });
      }
      bcrypt.compare(password, user.password, function(err, result) {
        if (err) {
          return done(err);
        }
        if (!result) {
          return done(null, false, { message: 'Incorrect password' });
        }
        console.log('USER:' + user.email);
        return done(null, user);
      });
    });
  }
));

// Serialize User
passport.serializeUser((user, done) => {
  console.log('=>serializeUser ' + user.id);
  done(null, user.id);
});

// Deserialize User
passport.deserializeUser((id, done) => {
  console.log('=>deserializeUser ' + id);
  db.findById(id, (err, user) => {
    done(err, user);
  });
});

// Routes
app.get('/', (req, res) => {
  res.status(200).send('Naviga nel mio e-commerce!')
});

// Login Route
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    if (!user) {
      return res.status(401).json({ message: info.message });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return res.status(200).json({ message: 'Login effettuato con successo', token });
  })(req, res, next);
});

// Logout Route
app.post('/logout', (req, res) => {
  req.logout();
  res.status(200).json({ message: 'Logout effettuato con successo' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`);
});
