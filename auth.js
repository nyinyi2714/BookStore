const jwt = require("jsonwebtoken");

const config = process.env;

const verifyToken = (req, res, next) => {
  const token =
    req.body.token || req.query.token || req.cookies.token || req.headers["x-access-token"]

  if (!token) {
    res.user = null
    return next()
  }
  try {
    const decoded = jwt.verify(token, config.TOKEN_KEY)
    req.user = decoded.user
    return next()

  } catch (err) {
    return res.status(401).send("Invalid Token")
  }
  
}

module.exports = verifyToken