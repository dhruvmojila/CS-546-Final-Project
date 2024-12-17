import { ObjectId } from "mongodb";
import { questions, surveyAnswer } from "../config/mongoCollections.js";
import { validationMethods } from "../utils/helpers/validations.js";
import { checkId } from "../utils/helpers/helpers.js";

export const getQuestionById = async (id) => {
  id = validationMethods.isValidObjectId(id);
  const questionsCollection = await questions();
  const category = await questionsCollection.findOne(
    { "questions.questionId": id.toString() },
    { projection: { "questions.$": 1, categoryName: 1 } }
  );
  if (!category?.questions || category.questions.length === 0) {
    throw new Error(`Question with ID "${id}" not found`);
  }
  return {
    ...category.questions[0],
    categoryName: category.categoryName,
  };
};

// export const getAllQuestionsWithGivenIds = async (objectIds) => {
//   //   objectIds = objectIds.map((id) => ObjectId.createFromHexString(id));
//   const questionsCollection = await questions();
//   const categories = await questionsCollection
//     .find({ "questions.questionId": { $in: objectIds } })
//     .toArray();

//   //   console.log(categories);

//   const allQuestions = categories.reduce((acc, category) => {
//     const categoryQuestions = category.questions.map((question) => ({
//       ...question,
//       categoryName: category.categoryName,
//     }));
//     return acc.concat(categoryQuestions);
//   }, []);
//   return allQuestions;
// };

export const getAllQuestionsWithGivenIds = async (objectIds) => {
    objectIds = validationMethods.isValidArrayOfStrings(objectIds);
    objectIds = [...new Set(objectIds)];
    if (objectIds.length === 0) {
        return [];
    }
	const questionsCollection = await questions();
	const categories = await questionsCollection
		.find({ 'questions.questionId': { $in: objectIds } })
		.toArray();
	const surveyQuestions = categories.flatMap((category) =>
		category.questions
			.filter((question) => objectIds.includes(question.questionId))
			.map((question) => ({
				...question,
				categoryName: category.categoryName,
			}))
	);
	return surveyQuestions;
};  

export const surveyResponse = async (
  surveyId,
  surveyAnswers,
  surveydBy,
  surveyingFor
) => {
  const surveyAnswerCollection = await surveyAnswer();
  let errors = [];
  try {
    surveyId = checkId(surveyId, "surveyId");
    surveyingFor = checkId(surveyingFor, "surveyingFor");
    surveydBy = checkId(surveydBy, "surveydBy");
  } catch (e) {
    errors.push(e);
  }

  Object.keys(surveyAnswers).map(async (queId) => {
    try {
      let questionData = await getQuestionById(queId);
      switch (questionData.type) {
        case "single_select":
          surveyAnswers[queId] = checkString(
            surveyAnswers[queId],
            questionData.questionText
          );
          break;
        case "multi_select":
          isValidArray(surveyAnswers[queId]);
          break;
        case "rating":
          surveyAnswers[queId] = ratingValidation(surveyAnswers[queId]);
          break;
        case "text":
          surveyAnswers[queId] = checkString(
            surveyAnswers[queId],
            questionData.questionText
          );
          break;
        default:
          if (!surveyAnswers[queId]) {
            throw `Not a valid answer for ${questionData.questionText}`;
          }
          break;
      }
    } catch (e) {
      errors.push(e);
    }
  });

  if (errors.length > 0) {
    return {
      answerAdded: false,
      errors,
    };
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const currentDate = `${month}-${year}-${day}`;

  const newAnswerObj = {
    surveyId,
    surveydBy,
    surveyingFor,
    answers: surveyAnswers,
    submittedAt: currentDate,
  };

  const insertedInfo = await surveyAnswerCollection.insertOne(newAnswerObj);
  if (!insertedInfo.acknowledged || !insertedInfo.insertedId)
    throw "Could not add answer to a database!!";
  return { answerAdded: true };
};

export const getSurveyAnswer = async (surveyId, surveyedBy, surveyingForId) => {
  //   objectIds = objectIds.map((id) => ObjectId.createFromHexString(id));
  const answerCollection = await surveyAnswer();
  const answer = await answerCollection.findOne({
    surveyId: surveyId,
    surveydBy: surveyedBy,
    surveyingFor: surveyingForId,
  });

  if (!answer) {
    throw "No answer found";
  }

  return answer;
};
export const getSurveyAnswerStatistics = async (surveyId, surveyFor) => {
  const answerCollection = await surveyAnswer();
  const answer = await answerCollection
    .find({
      surveyId: surveyId.toString(),
      surveyingFor: surveyFor.toString(),
    })
    .toArray();

  if (!answer) {
    throw "No answer found";
  }

  return answer;
};
export const getSurveyAnswerStatisticsForAdmin = async (surveyId) => {
  const answerCollection = await surveyAnswer();
  const answer = await answerCollection
    .find({
      surveyId: surveyId.toString(),
    })
    .toArray();

  if (!answer) {
    throw "No answer found";
  }

  return answer;
};
export const getSurveyListForUser = async (userId) => {
  const answerCollection = await surveyAnswer();
  const answer = await answerCollection
    .find({
      surveyingFor: userId.toString(),
    })
    .toArray();

  if (!answer) {
    return [];
  }

  return answer;
};
