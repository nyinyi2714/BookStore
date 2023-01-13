const express = require('express')
const app = express()


const mongoose = require('mongoose')
async function connectDB() {
    try {
        await mongoose.connect(process.env.DATABASE_URL, { useNewURLParser: true })
    } catch(err) {
        console.log(err)
    }
    
}


// const cors = require('cors')
// app.use(cors({origin: "https://bookstore-react-self.vercel.app", credentials: true}))

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "https://bookstore-react-self.vercel.app")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    res.header("Access-Control-Allow-Credentials", true)
    next()
 })

const fs = require("fs")

// BodyParser
const bodyParser = require('body-parser')	
app.use(bodyParser.urlencoded({extended: false}))			
app.use(express.json())

// Multer
const multer = require("multer")
const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public")
    },
    filename: (req, file, cb) => {
        const ext = file.mimetype.split("/")[1];
        cb(null, `img/bookcovers/${Date.now()}.${ext}`);
    }
})
const upload = multer({
    storage: multerStorage
})


// Authentication with passport.js
const jwt = require("jsonwebtoken")
const cookieParser = require('cookie-parser')
const bcrypt = require('bcrypt')
const auth = require("./auth")

app.use(cookieParser(process.env.SESSION_SECRET))
app.use(auth)

// Mongodb DataBase
const User = require('./model/User')
const Book = require('./model/Book')

// Routes 
// create user account
app.post('/signup', async (req, res) => {

    // Check if the email is already in the database
    let existingUser = await User.findOne({email: req.body.email})
    if(existingUser) {
        res.json({err: "User Already Existed with this email"})
        return
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10)

    const newUser = new User({
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        password: hashedPassword,
        role: 'user',
        cart: [],
        purchasedBooks: [],
    })

    try {
        await newUser.save()
        res.json({message: "New User Successfully Created"})
    } catch(err) {
        res.json({err: "Server Error: Failed to create new User"})
    }
})

// Sign In User
app.post('/signin', async (req, res) => {
    try {
        // Get user input
        const { email, password } = req.body;
    
        // Validate if user exist in our database
        const user = await User.findOne({ email });
    
        if (user && (await bcrypt.compare(password, user.password))) {

          // Create token
          const token = jwt.sign(
            { user: user },
            process.env.TOKEN_KEY,
            {
              expiresIn: "2h",
            }
          );
    
          res.cookie("token", token, {
            secure: true,
            httpOnly: true,
            sameSite: "none"
          })

          res.json({message: "Sign in successfully"})

        } else {
            res.status(400).json({err: "Invalid Credentials"})
        }

      } catch (err) {
        console.log(err)
      }

})

//Log out User
app.get('/logout', (req, res) => {
    if(req.user) {
        res.clearCookie("token")
        res.json({message: "signed out successfully"})
    } else {
        res.json({err: "No user found to log out"})
    }
})

// Send current User 
app.get('/user', (req, res) => {
    if(req.user) res.json(req.user)
    else res.json({err: "no user found"})
    
})

// Send Books data in json
app.get('/books/json', async (req, res) => {
    let bookCollections = await Book.find()
    res.json(bookCollections)
})

// Create books by Admin 
app.post('/books/create', upload.single("file"), async (req, res) => {
    if(!req.user) {
        res.json({err: "No user is signed in"})
        return
    }

    if(req.user.role !== "admin") {
        res.json({err: "Only admin can create new books"})
        return
    }

    const newBook = new Book({
        title: req.body.title,
        rating: req.body.rating,
        price: req.body.price,
        bookCover: req.file.filename,
    })

    try {
        await newBook.save()
    } catch(err) {
        res.json({err: 'Failed to create the book'})
    }
    res.status(200).json({message: 'Book created successfully'})
})

// Delete Book from database
app.post("/delete_book", async (req, res) => {
    if(!req.user) {
        res.json({err: "No user is signed in"})
        return
    }
    if(req.user.role != "admin") {
        res.json({err: "Only Admin can delete books"})
        return
    }

    let bookToDelete = await Book.findOne({_id: req.body.id})
    let pathToBookCover = "./public/" + bookToDelete.bookCover
    let response = await Book.deleteOne({_id: req.body.id})
     
    // Delete book cover photo from backend folder
    fs.unlink(pathToBookCover, (err) => {
        if(err) throw err
        else res.json({message: "Book Cover photo deleted"})
    } )
})


// Send current user's cart data in json
app.get('/cart/json', async (req, res) => {
    if(!req.user) return res.json({err: "Need to sign in to view cart"})
    let user = await User.findOne({
        _id: req.user._id,
    })
    res.status(200).json(user.cart)
})

// Add new items into current user's cart
app.post('/cart/add', async (req, res) => {
    if(!req.user) return res.json({err: "Need to sign in to add books to cart"})
    
    let book = await Book.findOne( {_id: req.body.id} ) 
    await User.updateOne(
        {_id: req.user._id},
        {$push: { cart: book } }
    )

})

// Remove books from user's cart
app.post('/cart/remove', async (req, res) => {
    if(!req.user) return res.json({err: "Need to sign in to remove books from cart"})

    let currentUser = await User.findOne({ _id: req.user._id })
    if(currentUser.cart === []) res.json({err: "Cart is Empty"})

    // Find the book to delete in current User's cart
    let indexToDel = null
    for(let i = 0; i < currentUser.cart.length; i++) {
        if(currentUser.cart[i]._id.toString() === req.body.id) {
            indexToDel = i
            break
        }
    }

    // If can't find the book in the cart 
    if(indexToDel == null) return res.json({err: "Can't find the book in the cart"})

    // If book to delete is found, delete it
    currentUser.cart.splice(indexToDel, 1)

    await User.updateOne(
        { _id: req.user._id },
        {$set: { cart: currentUser.cart } }
    )

    res.status(200).json({message: "Successfully Removed"})
})

// Clear cart after puchase
app.post('/cart/clear', async (req, res) => {
    if(!req.user) return res.json({err: "No user is signed in"})
    await User.updateOne(
        {_id: req.user._id},
        {$set: { cart: [] } }
    )
    res.json({message: "Cart Cleared"})

})

// Make books purchase
app.post('/purchase', async (req, res) => {
    if(!req.user) return res.json({err: "Need to sign in to make purchase"})

    let newPurchasedBooks = req.user.purchasedBooks
    req.user.cart.forEach(book => {
        if(!containBook(req.user.purchasedBooks, book)) newPurchasedBooks.push(book)
    })

    await User.updateOne(
        { _id: req.user._id },
        {$set: { purchasedBooks: newPurchasedBooks }}
    )

    await User.updateOne(
        { _id: req.user._id },
        {$set: { cart: [] }}
    )

    res.json({message: "Books successfully purchased"})

})

app.post('/book/view', (req, res) => {
    if(!req.user) {
        res.json({err: "No user is signed in"})
        return
    }
    else if(!containBook(req.user.purchasedBooks, req.body.book)) {
        res.json({err: "User has not purchased the book"})
        return
    }
    res.download("./public/books/book1.pdf")
    res.end()
})

function containBook(books, book) {
    // if books is empty, return false
    if(books.length <= 0) return false

    for(let b = 0; b < books.length; b++) {
        if(books[b]._id.toString() === book._id.toString()) return true
    }
    return false
}

// Define static routes
app.use(express.static('public'))
app.use('/css', express.static(__dirname + 'public/css'))		
app.use('/js', express.static(__dirname + 'public/js'))
app.use('/img', express.static(__dirname + 'public/img'))


connectDB().then(() => {
    app.listen(3000)
})
