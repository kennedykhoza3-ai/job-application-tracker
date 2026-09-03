require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const { Pool } = require("pg");
const path = require("path");

const app = express();

const PORT =
  process.env.PORT || 3000;

const SESSION_SECRET =
  process.env.SESSION_SECRET;

const DATABASE_URL =
  process.env.DATABASE_URL;

const allowedStatuses = [
  "Applied",
  "Interview",
  "Offer",
  "Rejected"
];


/* =========================
   REQUIRED ENVIRONMENT
========================= */

if (!SESSION_SECRET) {
  console.error(
    "SESSION_SECRET is missing."
  );

  process.exit(1);
}

if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is missing."
  );

  process.exit(1);
}


/* =========================
   PRODUCTION PROXY
========================= */

if (
  process.env.NODE_ENV ===
  "production"
) {
  app.set(
    "trust proxy",
    1
  );
}


/* =========================
   BASIC SECURITY
========================= */

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "100kb"
  })
);


/* =========================
   SESSION
========================= */

app.use(
  session({
    secret: SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      sameSite: "lax",

      secure:
        process.env.NODE_ENV ===
        "production",

      maxAge:
        1000 *
        60 *
        60 *
        24
    }
  })
);


/* =========================
   STATIC FILES
========================= */

app.use(
  express.static(__dirname)
);


/* =========================
   POSTGRESQL DATABASE
========================= */

const pool =
  new Pool({
    connectionString:
      DATABASE_URL,

    ssl:
      process.env.NODE_ENV ===
      "production"
        ? {
            rejectUnauthorized:
              false
          }
        : false
  });


pool.on(
  "error",
  function (error) {

    console.error(
      "Unexpected PostgreSQL error:",
      error
    );

  }
);


/* =========================
   DATABASE SETUP
========================= */

async function initializeDatabase() {

  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (

        id SERIAL PRIMARY KEY,

        name VARCHAR(150)
        NOT NULL,

        email VARCHAR(255)
        NOT NULL
        UNIQUE,

        password_hash TEXT
        NOT NULL,

        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

      )
    `);


    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (

        id SERIAL PRIMARY KEY,

        company VARCHAR(255)
        NOT NULL,

        position VARCHAR(255)
        NOT NULL,

        date_applied DATE
        NOT NULL,

        status VARCHAR(50)
        NOT NULL,

        job_link TEXT,

        user_id INTEGER
        NOT NULL,

        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT
        fk_application_user

        FOREIGN KEY
        (user_id)

        REFERENCES users(id)

        ON DELETE CASCADE

      )
    `);


    /*
      Add job_link to databases
      that already have the
      applications table.
    */

    await pool.query(`
      ALTER TABLE applications

      ADD COLUMN IF NOT EXISTS
      job_link TEXT
    `);


    console.log(
      "PostgreSQL database ready."
    );

  } catch (error) {

    console.error(
      "Database initialization error:",
      error
    );

    process.exit(1);

  }

}


/* =========================
   HELPER FUNCTIONS
========================= */

function requireLogin(
  req,
  res,
  next
) {

  if (!req.session.userId) {

    return res
      .status(401)
      .json({

        error:
          "You must be logged in."

      });

  }

  next();

}


function validEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


function validStatus(status) {

  return allowedStatuses.includes(
    status
  );

}


function validJobLink(jobLink) {

  if (!jobLink) {
    return true;
  }

  try {

    const url =
      new URL(jobLink);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );

  } catch (error) {

    return false;

  }

}


/* =========================
   REGISTER
========================= */

app.post(
  "/api/register",

  async function (req, res) {

    const name =
      req.body.name
        ?.trim();

    const email =
      req.body.email
        ?.trim()
        .toLowerCase();

    const password =
      req.body.password;


    if (
      !name ||
      !email ||
      !password
    ) {

      return res
        .status(400)
        .json({

          error:
            "Name, email and password are required."

        });

    }


    if (name.length < 2) {

      return res
        .status(400)
        .json({

          error:
            "Please enter your full name."

        });

    }


    if (!validEmail(email)) {

      return res
        .status(400)
        .json({

          error:
            "Please enter a valid email address."

        });

    }


    if (password.length < 8) {

      return res
        .status(400)
        .json({

          error:
            "Password must contain at least 8 characters."

        });

    }


    try {

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );


      const result =
        await pool.query(
          `
            INSERT INTO users
            (
              name,
              email,
              password_hash
            )

            VALUES
            ($1, $2, $3)

            RETURNING
              id,
              name,
              email
          `,

          [
            name,
            email,
            passwordHash
          ]
        );


      const user =
        result.rows[0];


      req.session.userId =
        user.id;


      req.session.userName =
        user.name;


      return res
        .status(201)
        .json({

          message:
            "Account created successfully.",

          user

        });

    } catch (error) {

      if (
        error.code ===
        "23505"
      ) {

        return res
          .status(409)
          .json({

            error:
              "An account with this email already exists."

          });

      }


      console.error(
        "Registration error:",
        error
      );


      return res
        .status(500)
        .json({

          error:
            "Could not create account."

        });

    }

  }
);


/* =========================
   LOGIN
========================= */

app.post(
  "/api/login",

  async function (req, res) {

    const email =
      req.body.email
        ?.trim()
        .toLowerCase();

    const password =
      req.body.password;


    if (
      !email ||
      !password
    ) {

      return res
        .status(400)
        .json({

          error:
            "Email and password are required."

        });

    }


    try {

      const result =
        await pool.query(
          `
            SELECT
              id,
              name,
              email,
              password_hash

            FROM users

            WHERE email = $1
          `,

          [email]
        );


      if (
        result.rows.length === 0
      ) {

        return res
          .status(401)
          .json({

            error:
              "Incorrect email or password."

          });

      }


      const user =
        result.rows[0];


      const passwordMatches =
        await bcrypt.compare(
          password,
          user.password_hash
        );


      if (!passwordMatches) {

        return res
          .status(401)
          .json({

            error:
              "Incorrect email or password."

          });

      }


      req.session.userId =
        user.id;


      req.session.userName =
        user.name;


      return res.json({

        message:
          "Login successful.",

        user: {
          id:
            user.id,

          name:
            user.name,

          email:
            user.email
        }

      });

    } catch (error) {

      console.error(
        "Login error:",
        error
      );


      return res
        .status(500)
        .json({

          error:
            "Login failed."

        });

    }

  }
);


/* =========================
   LOGOUT
========================= */

app.post(
  "/api/logout",

  function (req, res) {

    req.session.destroy(
      function (error) {

        if (error) {

          return res
            .status(500)
            .json({

              error:
                "Could not log out."

            });

        }


        res.clearCookie(
          "connect.sid"
        );


        return res.json({

          message:
            "Logged out successfully."

        });

      }
    );

  }
);


/* =========================
   CURRENT USER
========================= */

app.get(
  "/api/me",

  async function (req, res) {

    if (!req.session.userId) {

      return res
        .status(401)
        .json({

          loggedIn: false

        });

    }


    try {

      const result =
        await pool.query(
          `
            SELECT
              id,
              name,
              email

            FROM users

            WHERE id = $1
          `,

          [
            req.session.userId
          ]
        );


      if (
        result.rows.length === 0
      ) {

        return res
          .status(401)
          .json({

            loggedIn: false

          });

      }


      return res.json({

        loggedIn: true,

        user:
          result.rows[0]

      });

    } catch (error) {

      console.error(
        "Current user error:",
        error
      );


      return res
        .status(500)
        .json({

          error:
            "Could not load user."

        });

    }

  }
);


/* =========================
   GET APPLICATIONS
========================= */

app.get(
  "/api/applications",

  requireLogin,

  async function (req, res) {

    try {

      const result =
        await pool.query(
          `
            SELECT

              id,

              company,

              position,

              date_applied
              AS "dateApplied",

              status,

              job_link
              AS "jobLink",

              created_at
              AS "createdAt"

            FROM applications

            WHERE user_id = $1

            ORDER BY id DESC
          `,

          [
            req.session.userId
          ]
        );


      return res.json(
        result.rows
      );

    } catch (error) {

      console.error(
        "Load applications error:",
        error
      );


      return res
        .status(500)
        .json({

          error:
            "Could not load applications."

        });

    }

  }
);


/* =========================
   CREATE APPLICATION
========================= */

app.post(
  "/api/applications",

  requireLogin,

  async function (req, res) {

    const company =
      req.body.company
        ?.trim();

    const position =
      req.body.position
        ?.trim();

    const dateApplied =
      req.body.dateApplied;

    const status =
      req.body.status;

    const jobLink =
      req.body.jobLink
        ?.trim() || null;


    if (
      !company ||
      !position ||
      !dateApplied ||
      !status
    ) {

      return res
        .status(400)
        .json({

          error:
            "Company, position, date and status are required."

        });

    }


    if (!validStatus(status)) {

      return res
        .status(400)
        .json({

          error:
            "Invalid application status."

        });

    }


    if (!validJobLink(jobLink)) {

      return res
        .status(400)
        .json({

          error:
            "Please enter a valid job link beginning with http:// or https://."

        });

    }


    try {

      const result =
        await pool.query(
          `
            INSERT INTO applications
            (
              company,
              position,
              date_applied,
              status,
              job_link,
              user_id
            )

            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6
            )

            RETURNING

              id,

              company,

              position,

              date_applied
              AS "dateApplied",

              status,

              job_link
              AS "jobLink"
          `,

          [
            company,
            position,
            dateApplied,
            status,
            jobLink,
            req.session.userId
          ]
        );


      return res
        .status(201)
        .json(
          result.rows[0]
        );

    } catch (error) {

      console.error(
        "Create application error:",
        error
      );


      return res
        .status(500)
        .json({

          error:
            "Could not save application."

        });

    }

  }
);


/* =========================
   UPDATE APPLICATION
========================= */

app.put(
  "/api/applications/:id",

  requireLogin,

  async function (req, res) {

    const id =
      Number(req.params.id);

    const company =
      req.body.company
        ?.trim();

    const position =
      req.body.position
        ?.trim();

    const dateApplied =
      req.body.dateApplied;

    const status =
      req.body.status;

    const jobLink =
      req.body.jobLink
        ?.trim() || null;


    if (!Number.isInteger(id)) {

      return res
        .status(400)
        .json({

          error:
            "Invalid application ID."

        });

    }


    if (
      !company ||
      !position ||
      !dateApplied ||
      !status
    ) {

      return res
        .status(400)
        .json({

          error:
            "Company, position, date and status are required."

        });

    }


    if (!validStatus(status)) {

      return res
        .status(400)
        .json({

          error:
            "Invalid application status."

        });

    }


    if (!validJobLink(jobLink)) {

      return res
        .status(400)
        .json({

          error:
            "Please enter a valid job link beginning with http:// or https://."

        });

    }


    try {

      const result =
        await pool.query(
          `
            UPDATE applications

            SET
              company = $1,

              position = $2,

              date_applied = $3,

              status = $4,

              job_link = $5

            WHERE id = $6

            AND user_id = $7

            RETURNING

              id,

              company,

              position,

              date_applied
              AS "dateApplied",

              status,

              job_link
              AS "jobLink"
          `,

          [
            company,
            position,
            dateApplied,
            status,
            jobLink,
            id,
            req.session.userId
          ]
        );


      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({

            error:
              "Application not found."

          });

      }


      return res.json({

        message:
          "Application updated successfully.",

        application:
          result.rows[0]

      });

    } catch (error) {

      console.error(
        "Update application error:",
        error
      );


      return res
        .status(500)
        .json({

          error:
            "Could not update application."

        });

    }

  }
);


/* =========================
   DELETE APPLICATION
========================= */

app.delete(
  "/api/applications/:id",

  requireLogin,

  async function (req, res) {

    const id =
      Number(req.params.id);


    if (!Number.isInteger(id)) {

      return res
        .status(400)
        .json({

          error:
            "Invalid application ID."

        });

    }


    try {

      const result =
        await pool.query(
          `
            DELETE FROM applications

            WHERE id = $1

            AND user_id = $2

            RETURNING id
          `,

          [
            id,
            req.session.userId
          ]
        );


      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({

            error:
              "Application not found."

          });

      }


      return res.json({

        message:
          "Application deleted successfully."

      });

    } catch (error) {

      console.error(
        "Delete application error:",
        error
      );


      return res
        .status(500)
        .json({

          error:
            "Could not delete application."

        });

    }

  }
);


/* =========================
   HOME PAGE
========================= */

app.get(
  "/",

  function (req, res) {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);


/* =========================
   START SERVER
========================= */

async function startServer() {

  await initializeDatabase();


  app.listen(
    PORT,

    function () {

      console.log(
        `Server running on port ${PORT}`
      );

    }
  );

}


startServer();