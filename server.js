require("dotenv").config();

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");

const app = express();

const PORT =
  process.env.PORT || 3000;

const SESSION_SECRET =
  process.env.SESSION_SECRET;

const allowedStatuses = [
  "Applied",
  "Interview",
  "Offer",
  "Rejected"
];

if (!SESSION_SECRET) {
  console.error(
    "SESSION_SECRET is missing. Please check your environment variables."
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
   DATABASE
========================= */

const db =
  new sqlite3.Database(
    "./applications.db",
    function (error) {

      if (error) {
        console.error(
          "Database connection error:",
          error.message
        );

        return;
      }

      console.log(
        "Connected to SQLite database."
      );
    }
  );


/* =========================
   DATABASE SETUP
========================= */

function initializeDatabase() {

  db.serialize(function () {

    db.run(`
      CREATE TABLE IF NOT EXISTS users (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        name TEXT NOT NULL,

        email TEXT NOT NULL UNIQUE,

        password_hash TEXT NOT NULL,

        created_at DATETIME
        DEFAULT CURRENT_TIMESTAMP

      )
    `);


    db.run(`
      CREATE TABLE IF NOT EXISTS applications (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        company TEXT NOT NULL,

        position TEXT NOT NULL,

        dateApplied TEXT NOT NULL,

        status TEXT NOT NULL,

        user_id INTEGER,

        created_at DATETIME
        DEFAULT CURRENT_TIMESTAMP

      )
    `);


    db.all(
      "PRAGMA table_info(applications)",

      [],

      function (error, columns) {

        if (error) {

          console.error(
            "Could not inspect database:",
            error.message
          );

          return;
        }


        const hasUserId =
          columns.some(
            function (column) {

              return (
                column.name ===
                "user_id"
              );

            }
          );


        if (!hasUserId) {

          db.run(
            `
              ALTER TABLE applications
              ADD COLUMN user_id INTEGER
            `,

            function (error) {

              if (error) {

                console.error(
                  "Database upgrade error:",
                  error.message
                );

                return;
              }

              console.log(
                "Applications table upgraded."
              );

            }
          );

        }

      }
    );

  });

}

initializeDatabase();


/* =========================
   HELPER FUNCTIONS
========================= */

function requireLogin(
  req,
  res,
  next
) {

  if (!req.session.userId) {

    return res.status(401).json({
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

      return res.status(400).json({
        error:
          "Name, email and password are required."
      });

    }


    if (name.length < 2) {

      return res.status(400).json({
        error:
          "Please enter your full name."
      });

    }


    if (!validEmail(email)) {

      return res.status(400).json({
        error:
          "Please enter a valid email address."
      });

    }


    if (password.length < 8) {

      return res.status(400).json({
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


      db.run(
        `
          INSERT INTO users
          (
            name,
            email,
            password_hash
          )

          VALUES (?, ?, ?)
        `,

        [
          name,
          email,
          passwordHash
        ],

        function (error) {

          if (error) {

            if (
              error.message.includes(
                "UNIQUE"
              )
            ) {

              return res
                .status(409)
                .json({

                  error:
                    "An account with this email already exists."

                });

            }


            console.error(
              error.message
            );


            return res
              .status(500)
              .json({

                error:
                  "Could not create account."

              });

          }


          const userId =
            this.lastID;


          req.session.userId =
            userId;


          req.session.userName =
            name;


          db.get(
            `
              SELECT COUNT(*)
              AS total
              FROM users
            `,

            [],

            function (
              countError,
              result
            ) {

              if (
                !countError &&
                result.total === 1
              ) {

                db.run(
                  `
                    UPDATE applications

                    SET user_id = ?

                    WHERE user_id
                    IS NULL
                  `,

                  [userId]
                );

              }

            }
          );


          return res
            .status(201)
            .json({

              message:
                "Account created successfully.",

              user: {
                id: userId,
                name,
                email
              }

            });

        }
      );

    } catch (error) {

      console.error(error);


      return res
        .status(500)
        .json({

          error:
            "Registration failed."

        });

    }

  }
);


/* =========================
   LOGIN
========================= */

app.post(
  "/api/login",

  function (req, res) {

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


    db.get(
      `
        SELECT *
        FROM users
        WHERE email = ?
      `,

      [email],

      async function (
        error,
        user
      ) {

        if (error) {

          console.error(
            error.message
          );


          return res
            .status(500)
            .json({

              error:
                "Database error."

            });

        }


        if (!user) {

          return res
            .status(401)
            .json({

              error:
                "Incorrect email or password."

            });

        }


        try {

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
              id: user.id,
              name: user.name,
              email: user.email
            }

          });

        } catch (error) {

          console.error(error);


          return res
            .status(500)
            .json({

              error:
                "Login failed."

            });

        }

      }
    );

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

  function (req, res) {

    if (!req.session.userId) {

      return res
        .status(401)
        .json({

          loggedIn: false

        });

    }


    db.get(
      `
        SELECT
          id,
          name,
          email

        FROM users

        WHERE id = ?
      `,

      [
        req.session.userId
      ],

      function (
        error,
        user
      ) {

        if (
          error ||
          !user
        ) {

          return res
            .status(401)
            .json({

              loggedIn: false

            });

        }


        return res.json({

          loggedIn: true,

          user

        });

      }
    );

  }
);


/* =========================
   GET APPLICATIONS
========================= */

app.get(
  "/api/applications",

  requireLogin,

  function (req, res) {

    db.all(
      `
        SELECT *

        FROM applications

        WHERE user_id = ?

        ORDER BY id DESC
      `,

      [
        req.session.userId
      ],

      function (
        error,
        rows
      ) {

        if (error) {

          console.error(
            error.message
          );


          return res
            .status(500)
            .json({

              error:
                "Could not load applications."

            });

        }


        return res.json(
          rows
        );

      }
    );

  }
);


/* =========================
   CREATE APPLICATION
========================= */

app.post(
  "/api/applications",

  requireLogin,

  function (req, res) {

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
            "All fields are required."

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


    db.run(
      `
        INSERT INTO applications
        (
          company,
          position,
          dateApplied,
          status,
          user_id
        )

        VALUES (?, ?, ?, ?, ?)
      `,

      [
        company,
        position,
        dateApplied,
        status,
        req.session.userId
      ],

      function (error) {

        if (error) {

          console.error(
            error.message
          );


          return res
            .status(500)
            .json({

              error:
                "Could not save application."

            });

        }


        return res
          .status(201)
          .json({

            id:
              this.lastID,

            company,

            position,

            dateApplied,

            status

          });

      }
    );

  }
);


/* =========================
   UPDATE APPLICATION
========================= */

app.put(
  "/api/applications/:id",

  requireLogin,

  function (req, res) {

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
            "All fields are required."

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


    db.run(
      `
        UPDATE applications

        SET
          company = ?,
          position = ?,
          dateApplied = ?,
          status = ?

        WHERE id = ?

        AND user_id = ?
      `,

      [
        company,
        position,
        dateApplied,
        status,
        id,
        req.session.userId
      ],

      function (error) {

        if (error) {

          console.error(
            error.message
          );


          return res
            .status(500)
            .json({

              error:
                "Could not update application."

            });

        }


        if (
          this.changes === 0
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
            "Application updated successfully."

        });

      }
    );

  }
);


/* =========================
   DELETE APPLICATION
========================= */

app.delete(
  "/api/applications/:id",

  requireLogin,

  function (req, res) {

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


    db.run(
      `
        DELETE FROM applications

        WHERE id = ?

        AND user_id = ?
      `,

      [
        id,
        req.session.userId
      ],

      function (error) {

        if (error) {

          console.error(
            error.message
          );


          return res
            .status(500)
            .json({

              error:
                "Could not delete application."

            });

        }


        if (
          this.changes === 0
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

      }
    );

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

app.listen(
  PORT,

  function () {

    console.log(
      `Server running on port ${PORT}`
    );
  }
);