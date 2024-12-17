import { Router } from 'express';
import createHttpError from 'http-errors';
import { ObjectId } from 'mongodb';
import { questionsDataFunctions, surveyDataFunctions } from '../data/index.js';
import {
	validationMethods,
	questionTypes,
} from '../utils/helpers/validations.js';
import { isAdminLoggedIn } from '../utils/middlewares/authMiddlewares.js';

const router = Router();
router.use(isAdminLoggedIn);

router.get('/', async (req, res, next) => {
	try {
		const questions = await questionsDataFunctions.getAllQuestions();
		return res.render('questionList', {
			title: 'Question List',
			questions,
		});
	} catch (error) {
		return res.status(500).render('error', {
			title: 'Error',
			message: error.message,
			link: '/questions',
			linkName: 'Questions tab',
		});
	}
});

router
	.route('/create-question')
	.get(async (req, res) => {
		try {
			return res.render('selectQuestionType', {
				title: 'Select Question Type',
				questionTypes: questionTypes,
			});
		} catch (error) {
			return res.status(500).render('error', {
				title: 'Error',
				message: error.message,
				link: '/questions',
				linkName: 'Questions tab',
			});
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
			return res.render('createQuestion', {
				title: 'Create Question',
				question,
				categories,
			});
		} catch (error) {
			return res.status(500).render('error', {
				title: 'Error',
				message: error.message,
				link: '/questions',
				linkName: 'Questions tab',
			});
		}
	});

router.route('/create-question/:id').post(async (req, res, next) => {
	const { id } = req.params;
	const {
		type,
		questionText,
		options: reqOptions,
		scale,
		category,
		newCategory,
	} = req.body;
	const questionData = {
		useCount: 0,
	};
	try {
		questionData.questionId = validationMethods.isValidString(
			id,
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
		switch (type) {
			case 'single_select':
			case 'multi_select':
				const options = Array.isArray(reqOptions)
					? reqOptions
					: reqOptions?.split(',');
				questionData.options = [
					...new Set(
						validationMethods.isValidArrayOfStrings(
							options,
							'Options'
						)
					),
				];
				if (questionData.options.length < 2) {
					throw new Error(
						'Question options should have at least 2 unique options'
					);
				}
				break;
			case 'rating':
				questionData.scale = validationMethods.isValidScale(
					scale,
					'Rating scale'
				);
				break;
			default:
				break;
		}
	} catch (error) {
		return res.status(500).render('error', {
			title: 'Error',
			message: error.message,
			link: '/questions',
			linkName: 'Questions tab',
		});
	}

	let selectedCategory = category;
	if (category === 'other') {
		if (!newCategory) {
			return next(
				createHttpError.BadRequest('New category name is required')
			);
		}
		selectedCategory = newCategory;
	}

	try {
		await questionsDataFunctions.addQuestionToCategory(
			selectedCategory,
			questionData
		);
		return res.redirect('/questions');
	} catch (error) {
		return res.status(500).render('error', {
			title: 'Error',
			message: error.message,
			link: '/questions',
			linkName: 'Questions tab',
		});
	}
});

router.route('/question/:id').delete(async (req, res) => {
	try {
		const { id: paramID } = req.params;
		const id = validationMethods.isValidString(paramID, 'Question ID');
		if (!id) {
			return res.status(400).render('error', {
				title: 'Error',
				message: 'Question ID is required',
				link: '/questions',
				linkName: 'Questions tab',
			});
		}
		const surveys = await surveyDataFunctions.getAllSurveys();
		const isQuestionUsed = surveys.some((survey) => {
			return Object.values(survey.selectedQuestions || {})
				.flat()
				.includes(id);
		});
		if (isQuestionUsed) {
			return res.status(400).render('error', {
				title: 'Error',
				message:
					'This question is currently being used in a survey and cannot be deleted!',
				link: '/questions',
				linkName: 'Questions tab',
			});
		}
		await questionsDataFunctions.deleteQuestion(id);
		return res.redirect('/questions');
	} catch (error) {
		return res.status(500).render('error', {
			title: 'Error',
			message: error.message,
			link: '/questions',
			linkName: 'Questions tab',
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
				return res.status(400).render('error', {
					title: 'Error',
					message: 'Question ID is required',
					link: '/questions',
					linkName: 'Questions tab',
				});
			}
			const question = await questionsDataFunctions.getQuestionById(id);
			if (!question) {
				return res.status(404).render('error', {
					title: 'Error',
					message: 'Question not found',
					link: '/questions',
					linkName: 'Questions tab',
				});
			}
			const categories = await questionsDataFunctions.getAllCategories();
			return res.render('editQuestion', {
				title: 'Edit Question',
				currCategory: question.categoryName,
				question,
				categories,
			});
		} catch (error) {
			return res.status(500).render('error', {
				title: 'Error',
				message: error.message,
				link: '/questions',
				linkName: 'Questions tab',
			});
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
					const options = Array.isArray(questionData.options)
						? questionData.options
						: questionData.options?.split(',');
					updatedQuestion.options =
						validationMethods.isValidArrayOfStrings(
							options,
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
		} catch (error) {
			return res.status(500).render('error', {
				title: 'Error',
				message: error.message,
				link: '/questions',
				linkName: 'Questions tab',
			});
		}
	});

// !Dummy route to demo survey
router
	.route('/testSurvey')
	.get(async (req, res) => {
		try {
			// Get question according to survey id
			const questions = await questionsDataFunctions.getAllQuestions();
			return res.render('testSurvey', {
				title: 'Survey',
				questions,
			});
		} catch (error) {
			return res.status(500).render('error', {
				title: 'Error',
				message: error.message,
				link: '/questions',
				linkName: 'Questions tab',
			});
		}
	})
	.post(async (req, res, next) => {});

export default router;
