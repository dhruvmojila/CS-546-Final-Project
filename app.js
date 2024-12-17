import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import exphbs from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import fileUpload from "express-fileupload";
import session from "express-session";
import xssMiddleware from "./utils/middlewares/xssMiddlewares.js";

import configRoutesFunction from "./routes/index.js";
import {
  roleBasedRouting,
  routeLog,
  signOutUserMiddleWare,
} from "./utils/middlewares/authMiddlewares.js";

const rewriteUnsupportedBrowserMethods = (req, res, next) => {
	if (req?.body?._method) {
		req.method = req.body._method;
		delete req.body._method;
	}
	next();
};

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    name: "AuthenticationState",
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(routeLog);
app.use(roleBasedRouting);
app.use("/auth/signoutuser", signOutUserMiddleWare);

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/public", express.static("public"));
app.use(xssMiddleware);

app.engine(
  "handlebars",
  exphbs.engine({
    defaultLayout: "main",
    helpers: {
      equals: function (a, b) {
        return a === b;
      },
      isEqual: (a, b) => a === b,
      add: (a, b) => a + b,
      or: (a, b) => a || b,
      and: (a, b) => a && b,
      range: (start, end) => {
        const range = [];
        for (let i = start; i <= end; i++) {
          range.push(i);
        }
        return range;
      },
    },
    partialsDir: ["views/partials/"],
  })
);

app.set("view engine", "handlebars");

app.use(
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
  })
);
app.use(rewriteUnsupportedBrowserMethods);

configRoutesFunction(app);

app.listen(PORT, () => {
  console.log(`Listning on http://localhost:${PORT}`);
});
