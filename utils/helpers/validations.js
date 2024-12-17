import { ObjectId } from 'mongodb';
import nlp from 'compromise';

const questionTypes = [
	{ name: 'Text', type: 'text' },
	{ name: 'Rating', type: 'rating' },
	{ name: 'Single Select', type: 'single_select' },
	{ name: 'Multi Select', type: 'multi_select' },
];

const stopWords = [
	'ourselves',
	'hers',
	'between',
	'yourself',
	'but',
	'again',
	'there',
	'about',
	'once',
	'during',
	'out',
	'very',
	'having',
	'with',
	'they',
	'own',
	'an',
	'be',
	'some',
	'for',
	'do',
	'its',
	'yours',
	'such',
	'into',
	'of',
	'most',
	'itself',
	'other',
	'off',
	'is',
	's',
	'am',
	'or',
	'who',
	'as',
	'from',
	'him',
	'each',
	'the',
	'themselves',
	'until',
	'below',
	'are',
	'we',
	'these',
	'your',
	'his',
	'through',
	'don',
	'nor',
	'me',
	'were',
	'her',
	'more',
	'himself',
	'this',
	'down',
	'should',
	'our',
	'their',
	'while',
	'above',
	'both',
	'up',
	'to',
	'ours',
	'had',
	'she',
	'all',
	'no',
	'when',
	'at',
	'any',
	'before',
	'them',
	'same',
	'and',
	'been',
	'have',
	'in',
	'will',
	'on',
	'does',
	'yourselves',
	'then',
	'that',
	'because',
	'what',
	'over',
	'why',
	'so',
	'can',
	'did',
	'not',
	'now',
	'under',
	'he',
	'you',
	'herself',
	'has',
	'just',
	'where',
	'too',
	'only',
	'myself',
	'which',
	'those',
	'i',
	'after',
	'few',
	'whom',
	't',
	'being',
	'if',
	'theirs',
	'my',
	'against',
	'a',
	'by',
	'doing',
	'it',
	'how',
	'further',
	'was',
	'here',
	'than',
	'try',
	'would',
	'could',
	'like',
	'really',
	'actually',
	'probably',
	'think',
	'maybe',
	'sure',
	'many',
	'much',
	'seem',
	'quite',
	'just',
	'anyway',
];

const processPhrase = (phrase) => {
	return phrase
		.toLowerCase()
		.replace(/[.,!?;:]/g, '')
		.trim();
};

const splitPhrases = (phrase) => {
	return phrase.includes(' and ')
		? phrase.split(' and ').map((p) => p.trim())
		: [phrase];
};
const filterPhrases = (phrases, stopWords) => {
	return phrases.filter(
		(phrase) => !stopWords.includes(phrase) && phrase.length > 1
	);
};

const updateKeywordCounts = (phrases, keywordCounts) => {
	phrases.forEach((phrase) => {
		keywordCounts[phrase] = (keywordCounts[phrase] || 0) + 1;
	});
};

const processAnswers = (answers, stopWords, keywordCounts) => {
	answers.forEach((response) => {
		const doc = nlp(response);
		let phrases = doc.nouns().out('array');
		phrases = phrases.map(processPhrase).flatMap(splitPhrases);
		phrases = filterPhrases(phrases, stopWords);
		updateKeywordCounts(phrases, keywordCounts);
	});
};

const isValidBoolean = (bool, paramName = 'Parameter') => {
	if (typeof bool !== 'boolean') {
		throw new Error(`${paramName} must be a boolean value`);
	}
};

const isValidString = (
	str,
	paramName = 'String param',
	returnTrimValue = true
) => {
	if (!str) throw new Error(`You must provide a ${paramName}`);
	if (typeof str !== 'string')
		throw new Error(`${paramName} should be of type of string`);
	if (!str.trim())
		throw new Error(
			`${paramName} cannot be an empty string or just spaces`
		);
	return returnTrimValue ? str.trim() : str;
};

const isValidNumber = (num, paramName = 'Number', throwError = true) => {
	const isValid = typeof num === 'number' && !isNaN(num);
	if (throwError && !isValid)
		throw new Error(`${paramName} should be a valid number`);
	return isValid;
};

const isValidWholeNumber = (num, paramName = 'Number') => {
	isValidNumber(num, paramName);
	let isValid = typeof num === 'number' && !isNaN(num);
	if (!isValid) throw new Error(`${paramName} should be a valid number`);
	isValid = Number.isInteger(num) && num >= 0;
	if (!isValid) throw new Error(`${paramName} should be a whole number`);
	return isValid;
};

const isValidArray = (arr, paramName = 'Array') => {
	if (!arr) throw new Error(`You must provide ${paramName}`);
	if (typeof arr !== 'object' || !Array.isArray(arr))
		throw new Error(
			`Invalid ${paramName}, ${paramName} should be an array`
		);
	if (!arr.length)
		throw new Error(`${paramName} argument should have at least one value`);
};

const isValidObject = (obj, paramName = 'Object', checkKeyLength = true) => {
	if (!obj) throw new Error(`You must provide a ${paramName}`);
	if (typeof obj !== 'object')
		throw new Error(`${paramName} should be of type object`);
	if (typeof obj === 'object') {
		if (Array.isArray(obj)) {
			throw new Error(`${paramName} cannot be an array`);
		} else {
			if (checkKeyLength && !Object.keys(obj).length)
				throw new Error(`${paramName} cannot be an empty object`);
		}
	}
};

const isValidObjectId = (id, paramName = 'ID') => {
	id = isValidString(id, paramName);
	if (!ObjectId.isValid(id)) throw new Error(`Invalid ${paramName}`);
	return ObjectId.createFromHexString(id);
};

const isValidArrayOfStrings = (arr, paramName = 'Array') => {
	isValidArray(arr, paramName);
	const trimmedArray = arr.map((item, index) => {
		try {
			return isValidString(item, `${paramName} [Index ${index}]`);
		} catch (error) {
			throw new Error(
				`${paramName} contains invalid value at index ${index}: ${error.message}`
			);
		}
	});

	return trimmedArray;
};

const isValidQuestionType = (type, paramName = 'Type') => {
	type = isValidString(type);
	const isValid = questionTypes.some((q) => q.type === type);
	if (!isValid) {
		throw new Error(`${paramName} is not a valid value!`);
	}
	return type;
};

const isValidScale = (scale, paramName = 'Scale') => {
	const numericScale = Number(scale);
	if (!Number.isInteger(numericScale)) {
		throw new Error(`${paramName} must be a whole number.`);
	}
	if (numericScale < 3 || numericScale > 10) {
		throw new Error(`${paramName} must be between 3 and 10.`);
	}
	return numericScale;
};

const validationMethods = {
	isValidBoolean,
	isValidString,
	isValidNumber,
	isValidWholeNumber,
	isValidArray,
	isValidObject,
	isValidObjectId,
	isValidArrayOfStrings,
	isValidQuestionType,
	isValidScale,
};

const saltRounds = 16;

export {
	validationMethods,
	saltRounds,
	questionTypes,
	stopWords,
	processAnswers,
};
