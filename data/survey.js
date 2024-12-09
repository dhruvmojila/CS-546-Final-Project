import { survey } from "../config/mongoCollections.js"
import * as helper from "../utils/helpers/survey.js";
import * as userData from "../data/users.js";

export const addSurvey = async (
    surveyName,
    startDate,
    endDate,
    surveyQuestionList,
    status,
    // surveyedBy,
    userMapping
  ) => {
    if(!surveyName || !startDate || !endDate || !status){
      throw "Please enter Survey Name, startDate, endDate and status!";
    }
    surveyName = helper.checkString(surveyName, "Survey Name");
    startDate = helper.sDateValidate(startDate);
    endDate = helper.eDateValidate(startDate,endDate);
    status = helper.statusValid(status);
    

    const surveyCollection= await survey();
    const surveyData = {
        surveyName,
        startDate,
        endDate,
        surveyQuestionList,
        status,
        // surveyedBy,
        userMapping
    };
    const insertedSurvey = await surveyCollection.insertOne(surveyData);
  
    if (!insertedSurvey || !insertedSurvey.insertedId) {
      throw "Survey data is not inserted.";
    }
    const newSurveyId = insertedSurvey.insertedId.toString();

    return insertedSurvey;
  };