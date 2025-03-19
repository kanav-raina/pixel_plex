const MeetingHistory = require('../../model/schema/meeting')
const Contact = require('../../model/schema/contact');
const Lead = require('../../model/schema/lead');
const User = require('../../model/schema/user');
const mongoose = require('mongoose');


const add = async (req, res) => {
    try {
        const { agenda, attendes, attendesLead, location, related, dateTime, notes, createBy } = req.body;

        if (!agenda || !createBy) {
            res.status(400).json({ error: 'Agenda and createBy are required' });
        }

        if (!mongoose.Types.ObjectId.isValid(createBy) || !(await User.findById(createBy))) {
            res.status(400).json({ error: 'Invalid or non-existent createBy value' });
        }

        if (attendes) {
            for (let id of attendes) {
                if (!mongoose.Types.ObjectId.isValid(id) || !(await Contact.findById(id))) {
                    return res.status(400).json({ error: `Invalid or non-existent attendee: ${id}` });
                }
            }
        }

        if (attendesLead) {
            for (let id of attendesLead) {
                if (!mongoose.Types.ObjectId.isValid(id) || !(await Lead.findById(id))) {
                    return res.status(400).json({ error: `Invalid or non-existent lead attendee: ${id}` });
                }
            }
        }

        const meeting = new MeetingHistory({
            agenda,
            attendes,
            attendesLead,
            location,
            related,
            dateTime,
            notes,
            createBy,
        });

        await meeting.save();
        res.status(201).json({ message: 'Meeting created successfully', meeting });
    } catch (err) {
        console.error('Error creating meeting:', err);
        res.status(500).json({ error: 'Failed to create meeting' });
    }
};

const index = async (req, res) => {
    try {
        const query = req.query
        query.deleted = false;

        const user = await User.findById(req.user.userId)
        if (user?.role !== "superAdmin") {
            delete query.createBy
            query = { createBy: new mongoose.Types.ObjectId(req.user.userId) };
        }
        let result = await MeetingHistory.aggregate([
            {$match: query},
            {
                $lookup:{
                    from:'User',
                    localField:'createBy',
                    foreignField:'_id',
                    as: 'createBy'
                }
            },
            {
                $lookup:{
                    from:'Contact',
                    localField:'attendes',
                    foreignField:'_id',
                    as: 'attendes'
                }
            },
            {
                $lookup:{
                    from:'Lead',
                    localField:'attendesLead',
                    foreignField:'_id',
                    as: 'attendesLead'
                }
            },
            { $unwind: { path: '$createBy', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$attendes', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$attendesLead', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    createByName: { $concat: ['$createBy.firstName', ' ', '$createBy.lastName'] }
                }
            },
            { $project: { createBy: 0 } }
        ]);
        res.status(200).json(result);
    } catch (err) {
        console.error('Error fetching meetings:', err);
        res.status(500).json({ error: 'Failed to fetch meetings' });
    }
};

const view = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid meeting ID' });
        }

        const result = await MeetingHistory.findOne({_id: req.params.id});

        if (!result) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        let response = await MeetingHistory.aggregate([
            {$match: { _id: result._id }},
            {
                $lookup:{
                    from:'User',
                    localField:'createBy',
                    foreignField:'_id',
                    as: 'createBy'
                }
            },
            {
                $lookup:{
                    from:'Contact',
                    localField:'attendes',
                    foreignField:'_id',
                    as: 'attendes'
                }
            },
            {
                $lookup:{
                    from:'Lead',
                    localField:'attendesLead',
                    foreignField:'_id',
                    as: 'attendesLead'
                }
            },
            { $unwind: { path: '$createBy', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$attendes', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$attendesLead', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    createByName: { $concat: ['$createBy.firstName', ' ', '$createBy.lastName'] }
                }
            },
            { $project: { createBy: 0 } }
        ]);

        res.status(200).json(response[0]);
    } catch (err) {
        console.error('Error fetching meeting:', err);
        res.status(500).json({ error: 'Failed to fetch meeting' });
    }
};

const deleteData = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid meeting ID' });
        }

        const meeting = await MeetingHistory.findByIdAndUpdate(req.params.id, { deleted: true });

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        res.status(200).json({ message: 'Meeting deleted successfully', meeting });
    } catch (err) {
        console.error('Error deleting meeting:', err);
        res.status(500).json({ error: 'Failed to delete meeting' });
    }
};

const deleteMany = async (req, res) => {
    try {
        const result = await MeetingHistory.updateMany({ _id: { $in: req.body } }, { $set: { deleted: true }});
        res.status(200).json({ message: 'Meetings deleted successfully', result });
    } catch (err) {
        console.error('Error deleting meetings:', err);
        res.status(500).json({ error: 'Failed to delete meetings' });
    }
};

module.exports = { add, index, view, deleteData, deleteMany }