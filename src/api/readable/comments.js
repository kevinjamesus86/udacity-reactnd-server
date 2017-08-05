const { Router } = require('express');
const router = (module.exports = new Router());
const bodyParser = require('body-parser');
const validate = require('../middleware/validate');
const { Post, Comment } = require('./models');

// POST /comments
// USAGE:
// Add a comment to a post
//
// PARAMS:
// body: String
// owner: String
// parentId: Should match a post id in the database.
router.post(
  '/comments',
  bodyParser.json(),
  validate({
    title: {
      in: 'body',
      notEmpty: true,
    },
    body: {
      in: 'body',
      notEmpty: true,
    },
    owner: {
      in: 'body',
      notEmpty: true,
    },
    parentId: {
      in: 'body',
      isMongoId: true,
    },
  }),
  (req, res, next) => {
    const { auth } = res.locals;
    const { body, owner, parentId } = req.body;

    // Assert that the Post exists
    // FKs would be nice here..
    Post.findOne(
      {
        _id: parentId,
        auth: auth || {
          $exists: false,
        },
      },
      `_id`,
      {
        lean: true,
      }
    )
      .then(
        post =>
          post ||
          // 422 UNPROCESSABLE ENTITY
          // https://httpstatuses.com/422
          Promise.reject({
            status: 422,
            message: `Unable to create Comment, Post<${parentId}> does not exist.`,
          })
      )
      .then(() =>
        Comment.create({
          auth,
          body,
          owner,
          parentId,
        })
      )
      .then(comment => res.json(comment))
      .catch(next);
  }
);

// GET /comments/:_id
// USAGE:
// Get the details for a single comment
router.get(
  '/comments/:_id',
  validate({
    _id: {
      in: 'params',
      isMongoId: true,
    },
  }),
  (req, res, next) => {
    const { auth } = res.locals;
    const { _id } = req.params;

    Comment.findOne(
      {
        _id,
        auth: auth || {
          $exists: false,
        },
      },
      {},
      {
        lean: true,
      }
    )
      .then(comment => res.json(comment))
      .catch(next);
  }
);

// PATCH /comments/:_id
// USAGE:
// Used for voting on a comment.
router.patch(
  '/comments/:_id',
  bodyParser.json(),
  validate({
    _id: {
      in: 'params',
      isMongoId: true,
    },
    option: {
      in: 'body',
      matches: {
        options: /^(upVote|downVote)$/,
      },
    },
  }),
  (req, res, next) => {
    const { auth } = res.locals;
    const { _id } = req.params;
    const { option } = req.body;

    const q = Comment.findOneAndUpdate(
      // Doc to update
      {
        _id,
        auth: auth || {
          $exists: false,
        },
      },
      // Changes to apply
      {
        $inc: {
          voteScore: option === 'upVote' ? 1 : -1,
        },
      },
      {
        // Return modified doc
        new: true,
        // Projection
        select: '_id voteScore',
      }
    );

    q.setOptions({ lean: true });

    q.then(comment => res.json(comment)).catch(next);
  }
);

// PATCH /comments/:_id
// USAGE:
// Edit the details of an existing comment
//
// PARAMS:
// body: String
router.patch(
  '/comments/:_id',
  bodyParser.json(),
  validate({
    _id: {
      in: 'params',
      isMongoId: true,
    },
    body: {
      in: 'body',
      notEmpty: true,
    },
  }),
  (req, res, next) => {
    const { auth } = res.locals;
    const { _id } = req.params;
    const { body } = req.body;

    const q = Comment.findOneAndUpdate(
      // Doc to update
      {
        _id,
        auth: auth || {
          $exists: false,
        },
      },
      // Changes to apply
      {
        timestamp: Date.now(),
        body,
      },
      {
        // Return modified doc
        new: true,
        // Projection
        fields: `_id timestamp body`,
      }
    );

    q.setOptions({ lean: true });

    q.then(post => res.json(post)).catch(next);
  }
);

// DELETE /comments/:_id
// USAGE:
// Sets a comment's deleted flag to 'true'
router.delete(
  '/comments/:_id',
  validate({
    _id: {
      in: 'params',
      isMongoId: true,
    },
  }),
  async (req, res, next) => {
    const { auth } = res.locals;
    const { _id } = req.params;

    const q = Comment.findOneAndUpdate(
      // Doc to update
      {
        _id,
        auth: auth || {
          $exists: false,
        },
      },
      // Changes to apply
      {
        deleted: true,
      },
      {
        // Projection
        fields: `_id`,
      }
    );

    q.setOptions({ lean: true });

    q.then(comment => res.json(comment)).catch(next);
  }
);