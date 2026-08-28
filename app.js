const authSection =
  document.getElementById("authSection");

const appSection =
  document.getElementById("appSection");

const registerForm =
  document.getElementById("registerForm");

const loginForm =
  document.getElementById("loginForm");

const authMessage =
  document.getElementById("authMessage");

const logoutButton =
  document.getElementById("logoutButton");

const welcomeMessage =
  document.getElementById("welcomeMessage");

const form =
  document.getElementById("applicationForm");

const applicationList =
  document.getElementById("applicationList");

const searchInput =
  document.getElementById("searchInput");

const filterStatus =
  document.getElementById("filterStatus");

const submitButton =
  document.getElementById("submitButton");

const totalCount =
  document.getElementById("totalCount");

const interviewCount =
  document.getElementById("interviewCount");

const offerCount =
  document.getElementById("offerCount");

const rejectedCount =
  document.getElementById("rejectedCount");

let applications = [];
let editingId = null;


/* =========================
   CHECK LOGIN
========================= */

async function checkLogin() {
  try {
    const response =
      await fetch("/api/me");

    if (!response.ok) {
      showLoginScreen();
      return;
    }

    const data =
      await response.json();

    showAppScreen(data.user);

    await loadApplications();

  } catch (error) {
    console.error(
      "Login check failed:",
      error
    );

    showLoginScreen();
  }
}


/* =========================
   REGISTER
========================= */

registerForm.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    authMessage.textContent =
      "Creating account...";

    const userData = {
      name:
        document
          .getElementById("registerName")
          .value
          .trim(),

      email:
        document
          .getElementById("registerEmail")
          .value
          .trim(),

      password:
        document
          .getElementById("registerPassword")
          .value
    };

    try {
      const response =
        await fetch("/api/register", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(userData)
        });

      const data =
        await response.json();

      if (!response.ok) {
        authMessage.textContent =
          data.error ||
          "Could not create account.";

        return;
      }

      registerForm.reset();

      authMessage.textContent = "";

      showAppScreen(data.user);

      await loadApplications();

    } catch (error) {
      console.error(error);

      authMessage.textContent =
        "Could not create account.";
    }
  }
);


/* =========================
   LOGIN
========================= */

loginForm.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    authMessage.textContent =
      "Logging in...";

    const loginData = {
      email:
        document
          .getElementById("loginEmail")
          .value
          .trim(),

      password:
        document
          .getElementById("loginPassword")
          .value
    };

    try {
      const response =
        await fetch("/api/login", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(loginData)
        });

      const data =
        await response.json();

      if (!response.ok) {
        authMessage.textContent =
          data.error ||
          "Login failed.";

        return;
      }

      loginForm.reset();

      authMessage.textContent = "";

      showAppScreen(data.user);

      await loadApplications();

    } catch (error) {
      console.error(error);

      authMessage.textContent =
        "Login failed.";
    }
  }
);


/* =========================
   LOGOUT
========================= */

logoutButton.addEventListener(
  "click",
  async function () {

    try {
      await fetch("/api/logout", {
        method: "POST"
      });

    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );
    }

    applications = [];
    editingId = null;

    form.reset();

    searchInput.value = "";

    filterStatus.value = "All";

    submitButton.textContent =
      "Add Application";

    applicationList.innerHTML = "";

    resetDashboard();

    showLoginScreen();
  }
);


/* =========================
   SCREEN DISPLAY
========================= */

function showLoginScreen() {
  authSection.classList.remove(
    "hidden"
  );

  appSection.classList.add(
    "hidden"
  );

  authMessage.textContent = "";
}


function showAppScreen(user) {
  authSection.classList.add(
    "hidden"
  );

  appSection.classList.remove(
    "hidden"
  );

  welcomeMessage.textContent =
    `Welcome, ${user.name}`;
}


/* =========================
   LOAD APPLICATIONS
========================= */

async function loadApplications() {
  try {
    const response =
      await fetch(
        "/api/applications"
      );

    if (response.status === 401) {
      showLoginScreen();
      return;
    }

    if (!response.ok) {
      throw new Error(
        "Could not load applications."
      );
    }

    applications =
      await response.json();

    updateDashboard();

    displayApplications();

  } catch (error) {
    console.error(error);

    applicationList.innerHTML = `
      <div class="empty-message">
        <p>
          Could not load applications.
        </p>
      </div>
    `;
  }
}


/* =========================
   DASHBOARD
========================= */

function updateDashboard() {
  totalCount.textContent =
    applications.length;

  interviewCount.textContent =
    applications.filter(
      function (app) {
        return (
          app.status ===
          "Interview"
        );
      }
    ).length;

  offerCount.textContent =
    applications.filter(
      function (app) {
        return (
          app.status ===
          "Offer"
        );
      }
    ).length;

  rejectedCount.textContent =
    applications.filter(
      function (app) {
        return (
          app.status ===
          "Rejected"
        );
      }
    ).length;
}


function resetDashboard() {
  totalCount.textContent = "0";
  interviewCount.textContent = "0";
  offerCount.textContent = "0";
  rejectedCount.textContent = "0";
}


/* =========================
   STATUS CLASS
========================= */

function getStatusClass(status) {
  return (
    "status-" +
    status.toLowerCase()
  );
}


/* =========================
   DATE FORMAT
========================= */

function formatDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date =
    new Date(
      `${dateValue}T00:00:00`
    );

  return date.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );
}


/* =========================
   DISPLAY APPLICATIONS
========================= */

function displayApplications() {
  applicationList.innerHTML = "";

  const searchText =
    searchInput.value
      .toLowerCase()
      .trim();

  const selectedStatus =
    filterStatus.value;

  const filteredApplications =
    applications.filter(
      function (app) {

        const matchesSearch =
          app.company
            .toLowerCase()
            .includes(searchText) ||

          app.position
            .toLowerCase()
            .includes(searchText);

        const matchesStatus =
          selectedStatus === "All" ||
          app.status ===
            selectedStatus;

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );

  if (
    filteredApplications.length === 0
  ) {
    applicationList.innerHTML = `
      <div class="empty-message">
        <p>
          No applications found.
        </p>
      </div>
    `;

    return;
  }

  filteredApplications.forEach(
    function (app) {

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "application-card";

      card.innerHTML = `
        <h3>
          ${escapeHtml(app.position)}
        </h3>

        <p>
          <strong>Company:</strong>
          ${escapeHtml(app.company)}
        </p>

        <p>
          <strong>Date applied:</strong>
          ${escapeHtml(
            formatDate(
              app.dateApplied
            )
          )}
        </p>

        <p>
          <strong>Status:</strong>

          <span
            class="status ${getStatusClass(app.status)}"
          >
            ${escapeHtml(app.status)}
          </span>
        </p>

        <div class="card-actions">

          <button
            class="edit-btn"
            data-id="${app.id}"
          >
            Edit
          </button>

          <button
            class="delete-btn"
            data-id="${app.id}"
          >
            Delete
          </button>

        </div>
      `;

      applicationList.appendChild(
        card
      );
    }
  );
}


/* =========================
   CREATE OR UPDATE
========================= */

form.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    const applicationData = {
      company:
        document
          .getElementById("company")
          .value
          .trim(),

      position:
        document
          .getElementById("position")
          .value
          .trim(),

      dateApplied:
        document
          .getElementById("dateApplied")
          .value,

      status:
        document
          .getElementById("status")
          .value
    };

    let url =
      "/api/applications";

    let method =
      "POST";

    if (editingId !== null) {
      url =
        `/api/applications/${editingId}`;

      method =
        "PUT";
    }

    submitButton.disabled = true;

    submitButton.textContent =
      editingId === null
        ? "Saving..."
        : "Updating...";

    try {
      const response =
        await fetch(url, {
          method,

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              applicationData
            )
        });

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
          "Could not save application."
        );

        return;
      }

      editingId = null;

      form.reset();

      await loadApplications();

    } catch (error) {
      console.error(error);

      alert(
        "Could not save application."
      );

    } finally {
      submitButton.disabled = false;

      submitButton.textContent =
        "Add Application";
    }
  }
);


/* =========================
   APPLICATION BUTTONS
========================= */

applicationList.addEventListener(
  "click",
  async function (event) {

    const button =
      event.target.closest(
        "button"
      );

    if (!button) {
      return;
    }

    const id =
      Number(
        button.dataset.id
      );

    if (
      button.classList.contains(
        "edit-btn"
      )
    ) {
      editApplication(id);
    }

    if (
      button.classList.contains(
        "delete-btn"
      )
    ) {
      await deleteApplication(id);
    }
  }
);


/* =========================
   EDIT APPLICATION
========================= */

function editApplication(id) {
  const application =
    applications.find(
      function (app) {
        return app.id === id;
      }
    );

  if (!application) {
    return;
  }

  document.getElementById(
    "company"
  ).value =
    application.company;

  document.getElementById(
    "position"
  ).value =
    application.position;

  document.getElementById(
    "dateApplied"
  ).value =
    application.dateApplied;

  document.getElementById(
    "status"
  ).value =
    application.status;

  editingId = id;

  submitButton.textContent =
    "Update Application";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================
   DELETE APPLICATION
========================= */

async function deleteApplication(id) {
  const confirmed =
    confirm(
      "Are you sure you want to delete this application?"
    );

  if (!confirmed) {
    return;
  }

  try {
    const response =
      await fetch(
        `/api/applications/${id}`,
        {
          method: "DELETE"
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      alert(
        data.error ||
        "Could not delete application."
      );

      return;
    }

    if (editingId === id) {
      editingId = null;

      form.reset();

      submitButton.textContent =
        "Add Application";
    }

    await loadApplications();

  } catch (error) {
    console.error(error);

    alert(
      "Could not delete application."
    );
  }
}


/* =========================
   SAFE HTML OUTPUT
========================= */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* =========================
   SEARCH AND FILTER
========================= */

searchInput.addEventListener(
  "input",
  displayApplications
);

filterStatus.addEventListener(
  "change",
  displayApplications
);


/* =========================
   START APP
========================= */

checkLogin();