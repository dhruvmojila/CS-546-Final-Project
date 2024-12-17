import { Router } from "express";
import { dashboardDataFunctions, usersDataFunctions } from "../data/index.js";
import { getSurveyById } from "../data/survey.js";
import { getAllUserWithProvidedIds } from "../data/users.js";
import {
  getAllQuestionsWithGivenIds,
  getSurveyAnswer,
  getSurveyAnswerStatistics,
  getSurveyAnswerStatisticsForAdmin,
  getQuestionById,
} from "../data/dashboard.js";
import {
  calculateMutliChoiceStates,
  calculateSingleChoiceCount,
  checkId,
  checkString,
  findAverage,
  isValidArray,
  ratingValidation,
} from "../utils/helpers/helpers.js";
import { users } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import { stopWords, processAnswers } from "../utils/helpers/validations.js";
import nlp from "compromise";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const router = Router();

const getSurveyDetails = async (surveysArr) => {
  let arrAns = [];
  if (surveysArr.length > 0) {
    arrAns = await Promise.all(
      surveysArr.map(async (surveyData) => {
        let obj = {};
        let curSurvey = await getSurveyById(surveyData.surveyId.toString());
        obj["surveyDetailsData"] = curSurvey;

        let pendingSurvey = await getAllUserWithProvidedIds(
          surveyData.surveyingFor
        );
        obj["completedSurvey"] = [];
        if (surveyData.responses && surveyData.responses.length) {
          let completedSurvey = await getAllUserWithProvidedIds(
            surveyData.responses
          );
          obj["completedSurvey"] = completedSurvey;
        }

        obj["surveyingForData"] = pendingSurvey;
        obj["isAnySurveyPending"] = pendingSurvey.length !== 0;
        obj["isAnySurveyCompleted"] = obj["completedSurvey"].length !== 0;
        // console.log(obj);
        return obj;
      })
    );
  }

  return arrAns;
};
const getSurveyQuestionsDetails = async (id) => {
  let survey = await getSurveyById(id);
  let arrAns = [];
  if (Object.keys(survey.selectedQuestions).length > 0) {
    arrAns = await Promise.all(
      Object.keys(survey.selectedQuestions).map(async (category) => {
        let obj = {};
        let allQueIds = survey.selectedQuestions[category];
        // console.log(category, allQueIds);
        obj["category"] = category;

        let queArr = await getAllQuestionsWithGivenIds(allQueIds);
        // console.log(queArr);
        obj["questions"] = queArr;
        return obj;
      })
    );
  }

  return arrAns;
};

router.route("/").get(async (req, res) => {
  const user = await usersDataFunctions.getUserById(req.session.user._id);
  if (!user) {
    return res.status(404).render("error", {
      title: "Not Found",
      message: "404: Not Found",
      link: "/",
      linkName: "Home",
    });
  }

  let surveyDetails = await getSurveyDetails(user.surveys);

  res.status(200).render("dashboard", {
    title: "Dashboard",
    curUser: user,
    surveyDetails,
  });
});

router
  .route("/fillSurvey/:surveyId/:surveyingForId/")
  .get(async (req, res) => {
    try {
      req.params.surveyId = checkId(req.params.surveyId);
      req.params.surveyingForId = checkId(req.params.surveyingForId);

      const surveyQuestionsDetails = await getSurveyQuestionsDetails(
        req.params.surveyId
      );
      res.status(200).render("fillSurvey", {
        title: "Fill Survey",
        questions: surveyQuestionsDetails,
        surveyId: req.params.surveyId,
        surveyingForId: req.params.surveyingForId,
      });
    } catch (e) {
      return res.status(404).render("error", {
        title: "Not Found",
        message: "404: Survey with that Id Not Found",
        link: "/",
        linkName: "Home",
      });
    }
  })
  .post(async (req, res) => {
    const surveyAnswerData = req.body;

    let errors = [];

    if (!surveyAnswerData || Object.keys(surveyAnswerData).length === 0) {
      errors.push("There are no fields in the request body");
    }

    try {
      req.params.surveyId = checkId(req.params.surveyId);
      req.params.surveyingForId = checkId(req.params.surveyingForId);
    } catch (e) {
      errors.push(e);
    }

    const surveyQuestionDetails = await getSurveyQuestionsDetails(
      req.params.surveyId
    );
    const allQuestions = surveyQuestionDetails.flatMap(
      (category) => category.questions
    );
    allQuestions.forEach((question) => {
      const questionId = question.questionId;
      if (
        !(questionId in surveyAnswerData) ||
        surveyAnswerData[questionId] === ""
      ) {
        errors.push(`Response required for: "${question.questionText}"`);
      } else {
        try {
          switch (question.type) {
            case "single_select":
              surveyAnswerData[questionId] = checkString(
                surveyAnswerData[questionId],
                question.questionText
              );
              break;
            case "multi_select":
              isValidArray(surveyAnswerData[questionId]);
              break;
            case "rating":
              surveyAnswerData[questionId] = ratingValidation(
                surveyAnswerData[questionId]
              );
              break;
            case "text":
              surveyAnswerData[questionId] = checkString(
                surveyAnswerData[questionId],
                question.questionText
              );
              break;
            default:
              if (!surveyAnswerData[questionId]) {
                throw `Not a valid answer for ${question.questionText}`;
              }
              break;
          }
        } catch (e) {
          errors.push(e);
        }
      }
    });

    // console.log(errors);

    if (errors.length > 0) {
      return res.status(400).render("fillSurvey", {
        title: "Fill Survey",
        hasErrors: true,
        errors,
        surveyAnswerData,
        questions: surveyQuestionDetails,
        surveyId: req.params.surveyId,
        surveyingForId: req.params.surveyingForId,
      });
    }

    try {
      const response = await dashboardDataFunctions.surveyResponse(
        req.params.surveyId,
        surveyAnswerData,
        req.session.user._id,
        req.params.surveyingForId
      );

      if (response.answerAdded) {
        const usersCollection = await users();

        const updatedUserInfo = await usersCollection.updateOne(
          { _id: ObjectId.createFromHexString(req.session.user._id) },
          {
            $pull: {
              "surveys.$[elem].surveyingFor": req.params.surveyingForId,
            },
            $push: {
              "surveys.$[elem].responses": req.params.surveyingForId,
            },
          },
          {
            arrayFilters: [
              {
                "elem.surveyId": ObjectId.createFromHexString(
                  req.params.surveyId
                ),
              },
            ],
          }
        );

        if (!updatedUserInfo) {
          throw "could not update user successfully because it doesnot exists anymore.";
        }

        // return updatedUserInfo;
        return res.redirect("/dashboard");
      } else {
        const surveyQuestionsDetails = await getSurveyQuestionsDetails(
          req.params.surveyId
        );
        return res.status(400).render("fillSurvey", {
          title: "Fill Survey",
          hasErrors: true,
          errors: response.errors,
          surveyAnswerData,
          questions: surveyQuestionsDetails,
          surveyId: req.params.surveyId,
          surveyingForId: req.params.surveyingForId,
        });
      }
    } catch (e) {
      console.log(e);

      return res.status(500).render("error", {
        title: "Error",
        message: "Internal Server Error",
        link: "/dashboard",
        linkName: "Dashboard",
      });
    }
  });

router
  .route("/filledSurveyPreview/:surveyId/:surveyingForId/")
  .get(async (req, res) => {
    try {
      req.params.surveyId = checkId(req.params.surveyId);
      req.params.surveyingForId = checkId(req.params.surveyingForId);

      const surveyAnswer = await getSurveyAnswer(
        req.params.surveyId,
        req.session.user._id,
        req.params.surveyingForId
      );
      if (!surveyAnswer) {
        // error
      }
      let questionAnswerObject = {};

      await Promise.all(
        Object.keys(surveyAnswer.answers).map(async (queId) => {
          let que = await getQuestionById(queId);

          if (Object.keys(questionAnswerObject).includes(que.categoryName)) {
            questionAnswerObject[que.categoryName].push({
              ...que,
              answer: surveyAnswer.answers[queId],
            });
          } else {
            questionAnswerObject[que.categoryName] = [
              {
                ...que,
                answer: surveyAnswer.answers[queId],
              },
            ];
          }
        })
      );

      // console.log(questionAnswerObject);

      res.status(200).render("filledSurveyPreview", {
        title: "Filled Survey Preview",
        questions: Object.entries(questionAnswerObject).map(([key, value]) => ({
          key,
          value,
        })),
        surveyId: req.params.surveyId,
        surveyingForId: req.params.surveyingForId,
      });
    } catch (e) {
      console.log(e);

      return res.status(404).render("error", {
        title: "Not Found",
        message: "404: Survey with that Id Not Found",
        link: "/",
        linkName: "Home",
      });
    }
  });

router.route("/surveystats/:surveyId/:userId/").get(async (req, res) => {
  try {
    req.params.surveyId = checkId(req.params.surveyId);
    req.params.userId = checkId(req.params.userId);

    const surveyAnswer = await getSurveyAnswerStatistics(
      req.params.surveyId,
      req.params.userId
    );

    let curSurvey = await getSurveyById(req.params.surveyId);

    if (!curSurvey) {
      throw "No survey found!";
    }

    if (!surveyAnswer) {
      throw "No survey answer found!";
      // error
    }

    let surveySentToTotal = 0;

    curSurvey.userMapping.map((usermap) => {
      surveySentToTotal += usermap.surveyedBy.length;
    });

    const allSurveyWithSentId = await getSurveyAnswerStatisticsForAdmin(
      req.params.surveyId
    );

    let surveyAnswerByTotal = allSurveyWithSentId.length;

    let combinedSurveyAnswer = {};
    surveyAnswer.map(async (answer) => {
      Object.keys(answer.answers).map((queId) => {
        if (Object.keys(combinedSurveyAnswer).includes(queId)) {
          combinedSurveyAnswer[queId].push(answer.answers[queId]);
        } else {
          combinedSurveyAnswer[queId] = [answer.answers[queId]];
        }
      });
    });
    let questionAnswerObject = {};
    await Promise.all(
      Object.keys(combinedSurveyAnswer).map(async (queId) => {
        let que = await getQuestionById(queId);

        if (Object.keys(questionAnswerObject).includes(que.categoryName)) {
          questionAnswerObject[que.categoryName].push({
            ...que,
            answer: combinedSurveyAnswer[queId],
          });
        } else {
          questionAnswerObject[que.categoryName] = [
            {
              ...que,
              answer: combinedSurveyAnswer[queId],
            },
          ];
        }
      })
    );

    Object.keys(questionAnswerObject).map(async (queCat) => {
      questionAnswerObject[queCat].map((que, index) => {
        switch (que.type) {
          case "single_select":
            let count = calculateSingleChoiceCount(que.answer);
            questionAnswerObject[queCat][index] = {
              ...questionAnswerObject[queCat][index],
              answerStats: JSON.stringify(count),
            };
            break;
          case "multi_select":
            let stats = calculateMutliChoiceStates(que.answer);
            questionAnswerObject[queCat][index] = {
              ...questionAnswerObject[queCat][index],
              answerStats: JSON.stringify(stats),
            };
            break;
          case "rating":
            let average = findAverage(que.answer);
            questionAnswerObject[queCat][index] = {
              ...questionAnswerObject[queCat][index],
              answerStats: JSON.stringify(average),
            };
            break;
          case "text":
            const keywordCounts = {};
                    processAnswers(que.answer, stopWords, keywordCounts);
					questionAnswerObject[queCat][index] = {
						...questionAnswerObject[queCat][index],
						extractedPhrases: JSON.stringify(keywordCounts),
					};
            break;
          default:
            break;
        }
      });
    });
    // ref: https://www.npmjs.com/package/groq-sdk
    const client = new Groq({
      apiKey: process.env["GROQ_API_KEY"],
    });
    let surveyStatesAnswer;
    try {
      surveyStatesAnswer = await client.chat.completions
        .create({
          messages: [
            {
              role: "system",
              content:
                "You are best analyst and have more than 20 years of experience. You will get one JSON data in strigify for. You task is to analyze it properly.",
            },
            {
              role: "user",
              content: `
              Here is json data:
              <jsonData>
              ${JSON.stringify(questionAnswerObject, null, 2)}
              </jsonData>
              <descriptionJsonData>
              above data is responses of people for perticular person. This data includes quetsions,
              answers as well as some answer statistics (answerStats). 
              </descriptionJsonData>

              your task is to user your analytical experience and generate summary from using json data
              provied. Summary must be of 100 to 200 words maximum but it should emphasize main points.
              The main goal is to summarise the data, so user get to know what kind of reponses they got for the given survey, 
              we mainly want overall insight by which can be useful to user.. Make sure no preamble or formatting. 
              Ans give reponse such as you are personal analytical agent of given user and should route like you are talking to them and do not mention about json data.
              `,
            },
          ],
          model: "llama-3.3-70b-versatile",
        })
        .catch(async (err) => {
          throw err;
        });
      // console.log(surveyStatesAnswer.choices[0].message.content);
    } catch (error) {
      console.log(error);
      return res.status(404).render("error", {
        title: "Not Found",
        message: "500: Internal Server Error",
        link: "/",
        linkName: "Home",
      });
    }
    // console.log(JSON.stringify(questionAnswerObject, null, 2));

    res.status(200).render("responseStats", {
      title: "Survey Stats",
      statsData: Object.entries(questionAnswerObject).map(([key, value]) => ({
        key,
        value,
      })),
      surveyId: req.params.surveyId,
      surveyingForId: req.params.surveyingForId,
      surveySentToTotal,
      surveyAnswerByTotal,
      aiGeneratedSummary: surveyStatesAnswer
        ? surveyStatesAnswer.choices[0].message.content
        : "No summary!",
    });
  } catch (e) {
    console.log(e);

    return res.status(404).render("error", {
      title: "Not Found",
      message: "404: Survey with that Id Not Found",
      link: "/",
      linkName: "Home",
    });
  }
});

export default router;
