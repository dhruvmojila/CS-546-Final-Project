import xss from 'xss';

const xssMiddleware = (req, res, next) => {
	if (req.body) {
		for (const key in req.body) {
			if (req.body[key]) {
				req.body[key] = xss(req.body[key]);
			}
		}
	}
	if (req.query) {
		for (const key in req.query) {
			if (req.query[key]) {
				req.query[key] = xss(req.query[key]);
			}
		}
	}
	if (req.params) {
		for (const key in req.params) {
			if (req.params[key]) {
				req.params[key] = xss(req.params[key]);
			}
		}
	}
	next();
};

export default xssMiddleware;
