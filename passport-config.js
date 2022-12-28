const passport = require('passport')
const localStrategy = require('passport-local')
const bcrypt = require('bcrypt')				
const User = require('./model/User')

const customFields = {
    usernameField: 'email',
    passwordField: 'password'
}

// function authenticateUser

passport.use(new localStrategy(customFields, async (email, password, done) => {
    const user = await User.findOne({ email: email })

    if(user == null) return done(null, false) 
   
    try {

        const isUserAuthenticated = await bcrypt.compare(password, user.password)
        if(isUserAuthenticated) return done(null, user)		
        return done(null, false)	
   
    } catch(err) {
        done(err)
    }
   
} )) 

passport.serializeUser((user, done) => {
    return done(null, user.id)					
})
   
passport.deserializeUser(async (userId, done) => {		
    const user = await User.findOne({ _id: userId })
    return done(null, user)
})