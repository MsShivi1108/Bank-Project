const userModel = require("../models/user.model")

const jwt = require("jsonwebtoken")

async function authMiddleware(req, res, next) {
    const authorization = req.headers.authorization
    const token = authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : req.cookies.token

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing"
        })
    }

    let decoded
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }

    const user = await userModel.findById(decoded.userId)
    if (!user) {
        return res.status(401).json({
            message: "Unauthorized access, user not found"
        })
    }

    req.user = user
    return next()

}

async function authSystemUserMiddleware(req, res, next) {

    const authorization = req.headers.authorization
    const token = authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : req.cookies.token

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing"
        })
    }
    let decoded
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }

    const user = await userModel.findById(decoded.userId).select("+systemUser")
    if (!user) {
        return res.status(401).json({
            message: "Unauthorized access, user not found"
        })
    }

    if (!user.systemUser) {
        return res.status(403).json({
            message: "Forbidden access, not a system user"
        })
    }

    req.user = user
    return next()

}

module.exports = {
    authMiddleware,
    authSystemUserMiddleware
}



