if(process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./queries');
const session = require("express-session");
const MemoryStore = require('memorystore')(session)
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const compression = require('compression');
const jwt = require('jsonwebtoken');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const helmet = require('helmet');
const stripe = require('./stripe')

const app = express();
const port = process.env.PORT || 3000;


//TOKEN JwtStrategy
const jwtOpts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

passport.use(new JwtStrategy(jwtOpts, function(jwt_payload, done) {
  console.log('IL MIO PAYLOAD è '+ jwt_payload.id)
    db.find(jwt_payload.id, function(err, user) {
        if (err) {
            return done(err, false);
        }
        if (user) {
            return done(null, user);
        } else {
            return done(null, false);
        }
    });
}));


// Authentication Middleware
function ensureAuthenticated(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: 'Non sei autenticato' });
    req.user = user;
    console.log(req.user.email)
    next();
  })(req, res, next);
}


/* function ensureAuthenticated(req, res, next) {
  console.log('Verifying authentication...');
  if (req.isAuthenticated()) {
  console.log('User is authenticated');
  return next();
  }
  console.log('User is not authenticated');
  res.status(401).json({ message: 'Non sei autenticato' });
  }
 */


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
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Set-Cookie'],
}

app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.set('trust proxy', 1);

app.use((req, res, next) => {
  if (req.originalUrl === '/stripe/webhook') {
    next(); // Skip body parsing middleware for /stripe/webhook
  } else {
    express.json()(req, res, next); // Use bodyParser for other routes
  }
});
app.use(express.urlencoded({ extended: true }));



// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({ 
    checkPeriod: 86400000, // Check expired sessions every 24 hours
    ttl: 7 * 24 * 60 * 60 * 1000, // Session TTL: 7 days
    dispose: (key, value) => {
      console.log(`Session ${key} is being disposed.`);
    },
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'none',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));


// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session());

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


// Check in log
/* app.use((req, res, next) => {
  console.log('Session:', req.session);
  console.log('User:', req.user);
  next();
}); */



// Routes
app.get('/', (req, res) => {
  res.status(200).send('Naviga nel mio e-commerce!')
});

//PAYMENT
app.use('/stripe', stripe);

// Example routes
app.get('/products/:id', db.getProductsDetailById);
app.get('/allProducts', db.getAllProducts);
app.get('/products', db.getCategory);
app.post('/products', db.createProduct);
app.delete('/products/:id', db.deleteProducts);
app.put('/products/:id', db.updateProduct);

app.get('/orders/:id', db.getOrdersById);
app.put('/orders/:id', db.updateOrdersById);
app.delete('/orders/:id', db.deleteOrder);
app.get('/orders/:id/detail', db.getOrdersProdottiById);

app.get('/allUsers', db.getAllUsers);
app.get('/users/:id', db.getUsersByID);
app.get('/users', db.getUsers);
app.put('/users', ensureAuthenticated, db.updateUser);
app.delete('/users', db.deleteUser);

app.put('/details/:id', db.updateDetail);

app.get('/allCart', db.getCartUser);

app.delete('/cart/:id', ensureAuthenticated, db.deleteCart);
app.get('/cart', ensureAuthenticated, db.cartActive);
app.post('/cart', ensureAuthenticated, db.createCart);
app.put('/cart/:id', ensureAuthenticated, db.addCart);
app.get('/orders', ensureAuthenticated, db.cartInactive);
app.get('/shipUser', ensureAuthenticated, db.getShipments);

app.get('/dashboard', ensureAuthenticated, db.dashboard);
app.get('/login', ensureAuthenticated, db.login);

// Registration Route
app.post('/register', async (req, res) => {
  try {
      const { nome, cognome, email, password } = req.body;

      if (!nome || !cognome || !email || !password) {
          return res.status(400).json({ error: 'All fields are required' });
      }
      if(password.length < 6 || password.length > 12){
        return res.status(406).json({ error: 'The password must be between 6 and 12 characters' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await db.createUser(nome, cognome, email, hashedPassword);

      res.status(200).json({ message: 'User registered successfully!', user: newUser });
  } catch (error) {
      console.error('Error during registration:', error);
      if(error.constraint){
        res.status(401).json({ error: 'The email already exists' });
      } else if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Error' });
      }
  }
});

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


// Login Route
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    if (!user) {
      return res.status(401).json({ message: info.message });
    }
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Login failed' });
      }
      const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({ message: 'Login effettuato con successo', token: "Bearer " + token });
    });
  })(req, res, next);
});

// Logout Route
app.post('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy(function(err) {
      if (err) {
        return next(err);
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logout done' });
    });
  });
});



// Start server
app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`);
});
