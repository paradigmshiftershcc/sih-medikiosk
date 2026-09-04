import CaseRecord from "../models/CaseRecord.js";

export const getDoctorQueue = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const cases = await CaseRecord.find({
      assignedDoctorId: doctorId,
      status: "ASSIGNED",
    })
      .populate("patientId", "name abhaId")
      .select(
        "createdAt priority redFlags ayushMode finalSummary.chiefComplaint",
      )
      .sort({ priority: -1, createdAt: 1 }); // Urgent first, then oldest

    res.status(200).json(cases);
  } catch (error) {
    res.status(500).json({ message: "Error fetching queue." });
  }
};
