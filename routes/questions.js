import { Router } from 'express';
import createHttpError from 'http-errors';
import { ObjectId } from 'mongodb';
import { questionsDataFunctions, surveyDataFunctions } from '../data/index.js';
import { validationMethods } from '../utils/helpers/validations.js';

const router = Router();

const questionTypes = [
	{ name: 'Text', type: 'text' },
	{ name: 'Rating', type: 'rating' },
	{ name: 'Single Select', type: 'single_select' },
	{ name: 'Multi Select', type: 'multi_select' },
];

router.get('/', async (req, res, next) => {
	try {
		const questions = await questionsDataFunctions.getAllQuestions();
		res.render('questionList', {
			title: 'Question List',
			questions,
		});
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

router
	.route('/create-question')
	.get(async (req, res) => {
		try {
			res.render('selectQuestionType', {
				title: 'Select Question Type',
				questionTypes: questionTypes,
			});
		} catch (e) {
			return res.status(500).json({ error: e.message });
		}
	})
	.post(async (req, res, next) => {
		let { type } = req.body;
		if (!type) {
			return next(
				createHttpError.BadRequest('Question type is required')
			);
		}
		const isValidType = questionTypes.some(
			(questionType) => questionType.type === type
		);
		if (!isValidType) {
			return next(createHttpError.BadRequest('Invalid question type'));
		}
		const question = {
			id: new ObjectId(),
			type,
			questionText: '',
		};
		switch (type) {
			case 'single_select':
			case 'multi_select':
				question.options = ['', ''];
				break;
			case 'rating':
				question.scale = 5;
				break;
			default:
				break;
		}
		try {
			const categories = await questionsDataFunctions.getAllCategories();
			res.render('createQuestion', {
				title: 'Create Question',
				question,
				categories,
			});
		} catch (e) {
			return res.status(500).json({ error: e.message });
		}
	});

router.route('/create-question/:id').post(async (req, res, next) => {
	// Todo: Error handling for question data
	const { id } = req.params;
	const { type, questionText, options, scale, category, newCategory } =
		req.body;

	let selectedCategory = category;
	if (category === 'other') {
		if (!newCategory) {
			return next(
				createHttpError.BadRequest('New category name is required')
			);
		}
		selectedCategory = newCategory;
	}

	const questionData = {
		questionId: id,
		questionText,
		type,
		useCount: 0,
	};

	switch (type) {
		case 'single_select':
		case 'multi_select':
			questionData.options = options;
			break;
		case 'rating':
			questionData.scale = scale;
			break;
		default:
			break;
	}

	try {
		await questionsDataFunctions.addQuestionToCategory(
			selectedCategory,
			questionData
		);
		res.redirect('/questions');
	} catch (err) {
		next(createHttpError.InternalServerError(err.message));
	}
});

router.route('/question/:id').delete(async (req, res) => {
	try {
		const { id: paramID } = req.params;
		const id = validationMethods.isValidString(paramID, 'Question ID');
		if (!id) {
			return res.status(400).json({ error: 'Question ID is required' });
		}
		const surveys = await surveyDataFunctions.getAllSurveys();
		const isQuestionUsed = surveys.some((survey) => {
			return Object.values(survey.selectedQuestions || {})
				.flat()
				.includes(id);
		});
		if (isQuestionUsed) {
			return res.status(400).json({
				error: 'This question is currently being used in a survey and cannot be deleted!',
			});
		}
		await questionsDataFunctions.deleteQuestion(id);
		res.redirect('/questions');
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			error: 'An error occurred while deleting the question',
		});
	}
});

router
	.route('/question/edit/:id')
	.get(async (req, res) => {
		try {
			const { id: paramID } = req.params;
			const id = validationMethods.isValidString(paramID, 'Question ID');
			if (!id) {
				return res
					.status(400)
					.render('error', { message: 'Question ID is required' });
			}
			const question = await questionsDataFunctions.getQuestionById(id);
			if (!question) {
				return res
					.status(404)
					.render('error', { message: 'Question not found' });
			}
			const categories = await questionsDataFunctions.getAllCategories();
			res.render('editQuestion', {
				title: 'Edit Question',
				currCategory: question.categoryName,
				question,
				categories,
			});
		} catch (error) {
			console.error(error);
			return res
				.status(500)
				.render('error', { message: 'Internal Server Error' });
		}
	})
	.post(async (req, res, next) => {
		try {
			const { id: paramID } = req.params;
			const id = validationMethods.isValidString(paramID, 'Question ID');
			const questionData = req.body;
			const questionText = validationMethods.isValidString(
				questionData.questionText,
				'Question'
			);
			const type = validationMethods.isValidString(
				questionData.type,
				'Question type'
			);
			const category = validationMethods.isValidString(
				questionData.category,
				'Category'
			);
			if (!questionText) throw new Error('Question text is required');
			if (!type) throw new Error('Question type is required');
			const existingQuestionDetails =
				await questionsDataFunctions.getQuestionById(id);
			if (!existingQuestionDetails) {
				throw new Error('Question not found');
			}
			const surveys = await surveyDataFunctions.getAllSurveys();
			const isQuestionUsed = surveys.some((survey) =>
				Object.values(survey.selectedQuestions || {})
					.flat()
					.includes(id)
			);
			const updatedQuestion = {
				questionId: new ObjectId().toString(),
				questionText,
				type,
				useCount: 0,
			};
			switch (type) {
				case 'single_select':
				case 'multi_select':
					updatedQuestion.options =
						validationMethods.isValidArrayOfStrings(
							questionData.options,
							'Options'
						);
					break;
				case 'rating':
					updatedQuestion.scale = questionData.scale;
					break;
				default:
					break;
			}
			let targetCategory = category;
			if (category === 'other') {
				targetCategory = validationMethods.isValidString(
					questionData.newCategory,
					'New category'
				);
			}

			if (isQuestionUsed) {
				await questionsDataFunctions.addQuestionToCategory(
					targetCategory,
					updatedQuestion
				);
			} else {
				await questionsDataFunctions.deleteQuestion(id);
				await questionsDataFunctions.addQuestionToCategory(
					targetCategory,
					updatedQuestion
				);
			}
			res.redirect('/questions');
		} catch (e) {
			next(createHttpError.InternalServerError(e.message));
		}
	});

// !Dummy route to demo survey
router
	.route('/testSurvey')
	.get(async (req, res) => {
		try {
			// Get question according to survey id
			const questions = await questionsDataFunctions.getAllQuestions();
			res.render('testSurvey', {
				title: 'Survey',
				questions,
			});
		} catch (e) {
			return res.status(500).json({ error: e.message });
		}
	})
	.post(async (req, res, next) => {});

export default router;
