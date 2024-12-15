import { Router } from "express";
import * as surveyData from "../data/survey.js";
import * as userData from "../data/users.js";
import * as helper from "../utils/helpers/survey.js";
import nodemailer from "nodemailer";
import { questionsDataFunctions } from "../data/index.js";
import ExcelJS from "exceljs";

const router = Router();
router.get("/", async (req, res) => {
  const userList = await userData.getAllUsers();
  const surveyCreated = req.session.user._id;
  res.status(200).render("survey", {
    title: "Survey Form",
    userList: userList,
    surveyCreated: surveyCreated,
  });
});

// Add this Google Account
// email: surveysync100@gmail.com
// password: ProjectSync@100
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "SurveySync100@gmail.com",
    pass: "ddcg crof hpjf ddev",
  },
});

router.post("/", async (req, res, next) => {
  const surData = req.body;
  console.log(surData);
  if (!surveyData || Object.keys(surveyData).length === 0) {
    return res
      .status(400)
      .json({ error: "400 : No data passed in request body" });
  }
  try {
    let {
      surveyCreated,
      surveyName,
      startDate,
      endDate,
      questionnaire,
      status,
      userMappingData,
      selectedQuestions,
      inputType,
    } = surData;

    surveyName = helper.checkString(surveyName, "Survey Name");
    startDate = helper.sDateValidate(startDate);
    endDate = helper.eDateValidate(startDate, endDate);
    status = helper.statusValid(status);
    userMappingData = JSON.parse(userMappingData);
    selectedQuestions = JSON.parse(selectedQuestions);
    //surveyedFor = helper.checkId(surveyedFor,"Survey For");
    //surveyedBy = helper.checkId(surveyedBy,"Survey By");

    Object.keys(userMappingData).map(async (user) => {
      let currentuser = await userData.getUserById(user);
      let userEmail = [];
      userMappingData[user].forEach(async (val) => {
        const userList = await userData.getUserById(val);
        userEmail.push(userList.email);
      });
      const mailOptions = {
        from: "SurveySync100@gmail.com",
        to: userEmail,
        subject: "Thank you for completing the survey!",
        text: `
            Hi,

            Thank you for participating in our survey. 
            Your feedback is valuable to us!

            Survey Title: ${surveyName}
            You are surveying for : ${currentuser.firstName} ${
          currentuser.lastName
        }
            Date: ${new Date().toLocaleDateString()}
            
            Best regards,
            The Survey Team
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${userEmail}`);
    });
    // surveyedBy.forEach(async (val) => {
    //   const userList = await userData.getUserById(val);
    //   userEmail.push(userList.email);
    // });
    let finalRes = {};
    if (inputType !== "manual") {
      try {
        // console.log(req.files, req.body);

        if (!req.files?.file) {
          throw "No file";
        }

        const { file } = req.files;
        const fileExtension = file.name.split(".").pop().toLowerCase();

        // console.log(file.name);

        if (!["xlsx", "csv"].includes(fileExtension)) {
          throw "Only csv and excel supported.";
        }

        const workbook = new ExcelJS.Workbook();

        if (fileExtension === "csv") {
          await workbook.csv.load(file.data);
        } else {
          await workbook.xlsx.load(file.data);
        }

        const worksheet = workbook.worksheets[0];

        // console.log(worksheet);

        if (!worksheet || worksheet.rowCount < 2) {
          throw "empty file";
        }

        const headers = [];
        worksheet.getRow(1).eachCell((cell) => {
          headers.push(cell.value?.toString().toLowerCase() || "");
        });

        // console.log(headers, "header");

        if (
          headers[0].toLowerCase() !== "SurveyFor".toLowerCase() ||
          headers[1].toLowerCase() !== "SurveyBy".toLowerCase()
        ) {
          throw "two columns must be SurveyFor or SurveyBy";
        }

        const result = {};

        // console.log(worksheet.rowCount);

        for (let r = 2; r <= worksheet.rowCount; r++) {
          const row = worksheet.getRow(r);
          const surveyFor = row.getCell(1).value?.toString().toLowerCase();
          const surveyBy = row.getCell(2).value?.toString().toLowerCase();
          console.log(`${surveyBy} is surveying for ${surveyFor}`);

          if (!surveyFor || !surveyBy) continue;

          if (!result[surveyFor]) {
            result[surveyFor] = [];
          }

          if (Object.keys(result).includes(surveyFor)) {
            if (!result[surveyFor].includes(surveyBy)) {
              result[surveyFor].push(surveyBy);
            }
          } else {
            result[surveyFor] = [surveyBy];
          }
        }

        await Promise.all(
          Object.keys(result).map(async (userMap) => {
            let surveyinForUSer = await userData.getUserByUserId(userMap);
            finalRes[surveyinForUSer._id] = [];
            // console.log(userMap, "==========", result[userMap]);

            if (result[userMap].length) {
              await Promise.all(
                result[userMap].map(async (surveyByUserId) => {
                  let surveybyUSer = await userData.getUserByUserId(
                    surveyByUserId
                  );
                  finalRes[surveyinForUSer._id].push(surveybyUSer._id);
                })
              );
            }
          })
        );

        // console.log("excel data", finalRes);
      } catch (error) {
        console.log(error);

        return res.status(500).json({ error: "500 : Internal Server Error" });
      }
    }

    // console.log("userMappingData", userMappingData);

    const surveyDetails = await surveyData.addSurvey(
      surveyCreated,
      surveyName,
      startDate,
      endDate,
      questionnaire,
      status,
      inputType === "manual" ? userMappingData : finalRes,
      selectedQuestions
    );

    if (surveyDetails.acknowledged) {
      res.redirect("/dashboard");
    } else {
      return res.status(500).json({ error: "500 : Internal Server Error" });
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "500 : Internal Server Error" });
  }
});

router.route("/getAllQuestion").get(async (req, res) => {
  try {
    // Get question according to survey id
    const questions = await questionsDataFunctions.getAllQuestions();
    return res.status(200).json(questions);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.route("/surveyList").get(async (req, res) => {
  try {
    const userId = req.session.user._id;
    const surveyCollection = await surveyData.getSurveyList(userId);
    res
      .status(200)
      .render("surveyList", { title: "Survey List", surveyCollection });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.route("/delete/:id").post(async (req, res) => {
  try {
    await surveyData.removeSurvey(req.params.id);
    res.redirect("/surveyList");
  } catch (e) {
    return res.status(404).render("error");
  }
});

router.route("/edit/:id").post(async (req, res) => {
  try {
    const editSurvey = await surveyData.updateSurvey(req.params.id);
    res.redirect("/surveyList");
  } catch (e) {
    return res.status(404).render("error");
  }
});
export default router;
