import { questions } from '../config/mongoCollections.js';
import { validationMethods } from '../utils/helpers/validations.js';

const getAllCategories = async () => {
	const questionsCollection = await questions();
	const categories = await questionsCollection
		.find({}, { projection: { categoryName: 1, _id: 0 } })
		.toArray();
	return categories.map((category) => category.categoryName);
};

const getAllQuestions = async () => {
	const questionsCollection = await questions();
	const categories = await questionsCollection.find({}).toArray();
	const allQuestions = categories.reduce((acc, category) => {
		const categoryQuestions = category.questions.map((question) => ({
			...question,
			categoryName: category.categoryName,
		}));
		return acc.concat(categoryQuestions);
	}, []);
	return allQuestions;
};

const getAllQuestionsByCategoryName = async (categoryName) => {
	categoryName = validationMethods.isValidString(categoryName);
	const questionsCollection = await questions();
	const category = await questionsCollection.findOne({ categoryName });
	if (!category) {
		throw new Error(`Category with name "${categoryName}" not found`);
	}
	return category?.questions || [];
};

const getQuestionById = async (id) => {
	id = validationMethods.isValidString(id, 'Question ID');
	const questionsCollection = await questions();
	const category = await questionsCollection.findOne(
		{ 'questions.questionId': id },
		{ projection: { 'questions.$': 1, categoryName: 1 } }
	);
	if (!category?.questions || category.questions.length === 0) {
		throw new Error(`Question with ID "${id}" not found`);
	}
	return {
		...category.questions[0],
		categoryName: category.categoryName,
	};
};

const addQuestionToCategory = async (categoryName, questionData) => {
	categoryName = validationMethods.isValidString(categoryName);
	const { questionId, questionText, type, useCount, scale, options } =
		questionData;
	questionData.questionId = validationMethods.isValidString(
		questionId,
		'Question ID'
	);
	questionData.questionText = validationMethods.isValidString(
		questionText,
		'Question text'
	);
	questionData.type = validationMethods.isValidQuestionType(
		type,
		'Question type'
	);
	switch (questionData.type) {
		case 'rating':
			questionData.scale = validationMethods.isValidScale(
				scale,
				'Rating scale'
			);
			break;
		case 'single_select':
		case 'multi_select':
			questionData.options = [
				...new Set(
					validationMethods.isValidArrayOfStrings(options, 'Options')
				),
			];
			if (questionData.options.length < 2) {
				throw new Error(
					'Question options should have at least 2 unique options'
				);
			}
			break;
		default:
			break;
	}
	const questionsCollection = await questions();
	let category = await questionsCollection.findOne({ categoryName });
	if (!category) {
		category = { categoryName, questions: [] };
		await questionsCollection.insertOne(category);
	}
	const updateInfo = await questionsCollection.updateOne(
		{ categoryName },
		{ $push: { questions: questionData } }
	);
	if (updateInfo.modifiedCount === 0) {
		throw new Error('Error adding question!');
	}
};

const deleteQuestion = async (questionId) => {
	questionId = validationMethods.isValidString(questionId, 'Question ID');
	const questionsCollection = await questions();
	const category = await questionsCollection.findOne({
		'questions.questionId': questionId,
	});
	if (!category) throw new Error('Question not found');
	const questionToDelete = category.questions.find(
		(question) => question.questionId === questionId
	);
	const updateInfo = await questionsCollection.updateOne(
		{ 'questions.questionId': questionId },
		{ $pull: { questions: { questionId } } }
	);

	if (updateInfo.modifiedCount === 0) {
		throw new Error('Failed to delete the question');
	}
	return questionToDelete;
};

export {
	getAllCategories,
	getAllQuestions,
	getAllQuestionsByCategoryName,
	getQuestionById,
	addQuestionToCategory,
	deleteQuestion,
};
