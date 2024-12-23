import { ObjectId } from "mongodb";

export function checkId(id, varName) {
  if (!id) throw `Error: You must provide a ${varName}`;
  if (typeof id !== "string") throw `Error:${varName} must be a string`;
  id = id.trim();
  if (id.length === 0)
    throw `Error: ${varName} cannot be an empty string or just spaces`;
  if (!ObjectId.isValid(id)) throw `Error: ${varName} invalid object ID`;
  return id;
}

export function checkString(strVal, varName) {
  if (!strVal) throw `Error: You must supply a ${varName}!`;
  if (typeof strVal !== "string") throw `Error: ${varName} must be a string!`;
  strVal = strVal.trim();
  if (strVal.length === 0)
    throw `Error: ${varName} cannot be an empty string or string with just spaces`;
  return strVal;
}

export function isContainsNumber(str) {
  return str.split("").some((char) => !isNaN(parseInt(char)));
}

export function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export const ratingValidation = (rating) => {
  rating = checkString(rating);

  rating = parseInt(rating, 10);
  // console.log("====================================");
  // console.log(rating, isNaN(rating));
  // console.log("====================================");

  if (isNaN(rating)) {
    throw "Invalid rating";
  }

  return rating;
};

export const isValidArray = (arr, paramName = "Array") => {
  if (!arr) throw `You must provide ${paramName}`;
  if (typeof arr !== "object" || !Array.isArray(arr))
    throw `Invalid ${paramName}, ${paramName} should be an array`;
  if (typeof arr === "object" && !Array.isArray(arr))
    throw `Invalid ${paramName}, ${paramName} should be an array`;
  if (!arr.length) throw `${paramName} argument should have at least one value`;
};

export const findAverage = (arr) => {
  if (arr.length <= 0) {
    return 0;
  }
  const average = arr.reduce((sum, num) => sum + num, 0) / arr.length;
  return parseFloat(average.toFixed(2));
};

export const calculateSingleChoiceCount = (arr) => {
  const result = arr.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return result;
};
export const calculateMutliChoiceStates = (arr) => {
  const totalCounts = arr.flat().reduce((counts, option) => {
    counts[option] = (counts[option] || 0) + 1;
    return counts;
  }, {});

  const totalResponses = arr.length;
  const percentageDistribution = Object.entries(totalCounts).reduce(
    (percentages, [option, count]) => {
      percentages[option] = ((count / totalResponses) * 100).toFixed(2) + "%";
      return percentages;
    },
    {}
  );

  return {
    totalCounts,
    percentageDistribution,
  };
};
