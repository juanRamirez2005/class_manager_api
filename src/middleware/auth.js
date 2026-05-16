const jwt = require('jsonwebtoken');
const config = require('../config');
const HttpError = require('../utils/httpError');

function authRequired(req, _res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return next(new HttpError(401, 'Token Bearer requerido'));
    }
    try {
        const payload = jwt.verify(token, config.jwt.secret);
        req.user = { id: payload.sub, email: payload.email };
        next();
    } catch {
        next(new HttpError(401, 'Token inválido o expirado'));
    }
}

module.exports = { authRequired };
