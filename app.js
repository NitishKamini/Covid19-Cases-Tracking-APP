const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());

let dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeServerAndDatabase = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running on http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB error message: '${error.message}'`);
  }
};

initializeServerAndDatabase();

const verifyToken = (request, response, next) => {
  let jwtToken;
  let authToken = request.headers["authorization"];
  if (authToken !== undefined) {
    jwtToken = authToken.split(" ")[1];
  }
  if (jwtToken === undefined) {
    console.log(jwtToken);
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "NITISH", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API - ONE

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username LIKE '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser !== undefined) {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "NITISH");
      response.send({ jwtToken });
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

// API - TWO

const convertDbObject = (eachObject) => {
  return {
    stateId: eachObject.state_id,
    stateName: eachObject.state_name,
    population: eachObject.population,
  };
};

app.get("/states/", verifyToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray.map((eachState) => convertDbObject(eachState)));
});

// API - THREE

app.get("/states/:stateId/", verifyToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const stateDetails = await db.get(getStateDetailsQuery);
  response.send(convertDbObject(stateDetails));
});

// API - FOUR

app.post("/districts/", verifyToken, async (request, response) => {
  try {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const createDistrictQuery = `INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
            VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
    const dbResponse = await db.run(createDistrictQuery);
    response.send("District Successfully Added");
  } catch (error) {
    console.log(error.message);
  }
});

// API - FIVE

const converDistrictObj = (eachObject) => {
  return {
    districtId: eachObject.district_id,
    districtName: eachObject.district_name,
    stateId: eachObject.state_id,
    cases: eachObject.cases,
    cured: eachObject.cured,
    active: eachObject.active,
    deaths: eachObject.deaths,
  };
};

app.get("/districts/:districtId/", verifyToken, async (request, response) => {
  const { districtId } = request.params;
  const getDistrcitQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
  const districtDetails = await db.get(getDistrcitQuery);
  response.send(converDistrictObj(districtDetails));
});

// API - SIX

app.delete(
  "/districts/:districtId/",
  verifyToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    const dbResponse = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API - SEVEN

app.put("/districts/:districtId/", verifyToken, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updatedistrictQuery = `UPDATE district 
                       SET district_name = '${districtName}',
                            state_id = ${stateId},
                            cases = ${cases},
                            cured = ${cured},
                            active = ${active},
                            deaths = ${deaths}
                        WHERE district_id = ${districtId};`;
  const dbResponse = await db.run(updatedistrictQuery);
  response.send("District Details Updated");
});

// API - EIGHT

app.get("/states/:stateId/stats/", verifyToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateStatsQuery = `SELECT SUM(cases) as totalCases, SUM(cured) as totalCured, SUM(active) as totalActive, SUM(deaths) as totalDeaths  FROM district WHERE state_id = ${stateId}
  GROUP BY state_id;`;
  const statsObject = await db.get(getStateStatsQuery);
  response.send(statsObject);
});

module.exports = app;
