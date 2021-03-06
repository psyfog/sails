/**
 * Module dependencies
 */

var actionUtil = require('../actionUtil');
var _ = require('@sailshq/lodash');

/**
 * Create Record
 *
 * http://sailsjs.com/docs/reference/blueprint-api/create
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified criteria.  If an id was specified, just the instance with
 * that unique id will be returned.
 *
 */

module.exports = function createRecord (req, res) {

    var Model = actionUtil.parseModel(req);

    // Create data object (monolithic combination of all parameters),
    // omitting any blacklisted params.
    var data = actionUtil.parseValues(req);

    // Create new instance of model using data from params
    Model.create(data).exec(function created (err, newInstance) {

        // Differentiate between waterline-originated validation errors
        // and serious underlying issues. Respond with badRequest if a
        // validation error is encountered, w/ validation info.
        if (err) {
          return res.negotiate(err);
        }

        // If we have the pubsub hook, use the model class's publish method
        // to notify all subscribers about the created item
        if (req._sails.hooks.pubsub) {
            if (req.isSocket) {
                Model.subscribe(req, [newInstance[Model.primaryKey]]);
                Model._introduce(newInstance);
            }
            // Make sure data is JSON-serializable before publishing
            var publishData = _.isArray(newInstance) ?
                                _.map(newInstance, function(instance) {return instance.toJSON();}) :
                                newInstance.toJSON();
            Model._publishCreate(publishData, !req.options.mirror && req);
        }

        // Look up and populate the new record (according to `populate` options in request / config)
        var Q = Model.findOne(newInstance[Model.primaryKey]);
        Q = actionUtil.populateRequest(Q, req);
        Q.exec(function foundAgain(err, populatedRecord) {
          if (err) { return res.serverError(err); }
          if (!populatedRecord) { return res.serverError('Could not find record after creating!'); }
          // Send response
          res.ok(populatedRecord);
        }); // </foundAgain>

    });
};
