const crypto = require('crypto')
const Hapi = require('hapi')
const AuthBearer = require('hapi-auth-bearer-token')
const mongoose = require('mongoose')
const Joi = require('joi').extend(require('joi-phone-number'))
const moment = require('moment')
const tcpping = require('tcp-ping')

const TOKEN_TTL = 10

/* User model */
const User = mongoose.model('User', {
    login: { type: String, index: { unique: true } },
    password: String,
    login_type: String
})

/* User access token model */
const AccessToken = mongoose.model('AccessToken', {
    token: { type: String, index: { unique: true } },
    expires: { type: Date, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
})

const server = Hapi.server({ port: 4000, routes: { cors: true } })

/* Password encryption helper function */
const ecnryptString = (string) => {
    return crypto.createHash('sha256').update(string).digest('hex')
}

/* Token creation helper function */
const createToken = async (user) => {
    let expirationDate = moment().add(10, 'm').toDate()
    let token = new AccessToken({
        token: ecnryptString(`${user.login}${user.password}${expirationDate}`),
        expires: moment().add(TOKEN_TTL, 'm').toDate(),
        user: user._id
    })
    await token.save()
    return token
}

/* Check latency helper function */
const getLatency = (address, port) => {
    return new Promise((resolve, reject) => {
        tcpping.ping({address, port}, (err, result) => {
            if(err) {
                return reject(err)
            }
            if(isNaN(result.avg)) {
                return reject("Cant calculate average latency")
            }
            resolve(result)
        })
    })
}

/* User signup route handler */
server.route({
    method: 'POST',
    path: '/signup',
    handler: async (request, h) => {
        let user = await User.findOne({login: request.payload.id}).exec()
        if(user) {
            return h.response({error: 'User already exists'}).code(400)
        }
        user = new User({
            login: request.payload.id,
            password: ecnryptString(request.payload.password),
            login_type: Joi.string().email().validate(request.payload.id).error == null ? 'email' : 'phone'
        })
        user = await user.save()
        return {
            token: (await createToken(user)).token
        }
    },
    options: {
        payload: {
            allow: ['application/json']
        },
        validate: {
            payload: {
                id: [Joi.string().email(), Joi.string().phoneNumber()],
                password: Joi.string().required()
            }
        },
        auth: false
    }
})

/* User signin route handler */
server.route({
    method: 'POST',
    path: '/signin',
    handler: async (request, h) => {
        let user = await User.findOne({ login: request.payload.id, password: ecnryptString(request.payload.password) }).exec()
        if(!user) {
            return h.response({ error: "User not found" }).code(401)
        }
        return {
            token: (await createToken(user)).token
        }
    },
    options: {
        payload: {
            allow: ['application/json']
        },
        validate: {
            payload: {
                id: Joi.string().required(),
                password: Joi.string().required()
            }
        },
        auth: false
    }
})

/* User info route handler */
server.route({
    method: 'GET',
    path: '/info',
    handler: (request) => {
        return {
            login: request.auth.credentials.user.login,
            login_type: request.auth.credentials.user.login_type
        }
    }
})

/* Check latency route handler */
server.route({
    method: 'GET',
    path: '/latency',
    handler: async (request) => {
        try {
            let results = await getLatency('google.com', 443)
            return { average_latency: results.avg }
        } catch(error) {
            return {
                error: error
            }
        }

    }
})

/* Logout route handler */
server.route({
    method: 'GET',
    path: '/logout',
    handler: async (request) => {
        let deleteCondition = request.query.all == 'true' ? { user: request.auth.credentials.user._id } : { token: request.auth.credentials.token }
        await AccessToken.deleteMany(deleteCondition).exec()
        return {}
    }
})

/* Start server function */
const start = async () => {
    mongoose.connect(process.env.MONGO_CONNECTION_URL || 'mongodb://localhost/app')
    mongoose.set('debug', false)

    await server.register(AuthBearer)

    server.auth.strategy('bearer', 'bearer-access-token', {
        allowQueryToken: true,
        validate: async (request, token) => {
            let accessToken = await AccessToken.findOne({
                token: token,
                expires: { $gt: new Date() }
            }).populate('user').exec()
            accessToken.expires = moment().add(TOKEN_TTL, 'm').toDate()
            await accessToken.save()
            return { isValid: accessToken !== null, credentials: accessToken, artifacts: {} }
        }
    })

    server.auth.default('bearer')
    await server.start()
}

/* start server */
start()