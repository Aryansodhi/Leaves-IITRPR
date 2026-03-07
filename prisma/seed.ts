import {
  ApprovalStatus,
  DepartmentType,
  LeaveStatus,
  PrismaClient,
  RoleKey,
  WorkflowActor,
} from "@prisma/client";
import { addDays, startOfYear } from "date-fns";

const prisma = new PrismaClient();
const emailAlias = (slug: string) => `2023csb1288+${slug}@iitrpr.ac.in`;

const departments = [
  {
    code: "CSE",
    name: "Computer Science & Engineering",
    type: DepartmentType.ACADEMIC,
    description: "Teaching and research for computing disciplines.",
  },
  {
    code: "ESTAB",
    name: "Establishment & Admin",
    type: DepartmentType.ESTABLISHMENT,
    description: "Central leave cell and service records.",
  },
  {
    code: "ACCTS",
    name: "Accounts & Finance",
    type: DepartmentType.ACCOUNTS,
    description: "Reimbursements, LTC audits and salary payroll.",
  },
  {
    code: "DIR",
    name: "Director's Office",
    type: DepartmentType.DIRECTORATE,
    description: "Strategic approvals and institute-wide circulars.",
  },
];

const roles = [
  {
    key: RoleKey.FACULTY,
    name: "Faculty",
    isApprover: false,
    description: "Applicants who file leave and travel requests.",
  },
  {
    key: RoleKey.STAFF,
    name: "Institute Staff",
    isApprover: false,
    description: "Non-teaching employees requesting leave or LTC.",
  },
  {
    key: RoleKey.HOD,
    name: "Head of Department",
    isApprover: true,
    description: "Primary approver for teaching leave in each department.",
  },
  {
    key: RoleKey.ASSOCIATE_HOD,
    name: "Associate HoD",
    isApprover: true,
    description: "Delegated approver when HoD is away.",
  },
  {
    key: RoleKey.DEAN,
    name: "Dean Affairs",
    isApprover: true,
    description: "Clears HoD-vetted leave before Institute routing.",
  },
  {
    key: RoleKey.REGISTRAR,
    name: "Registrar",
    isApprover: true,
    description: "Admin head for staff leave and office orders.",
  },
  {
    key: RoleKey.DIRECTOR,
    name: "Director",
    isApprover: true,
    description: "Final authority for escalated or ex-India requests.",
  },
  {
    key: RoleKey.ACCOUNTS,
    name: "Accounts Officer",
    isApprover: true,
    description: "Finance checkpoints for LTC and reimbursements.",
  },
  {
    key: RoleKey.ESTABLISHMENT,
    name: "Establishment",
    isApprover: true,
    description: "Office order drafting and leave ledger maintenance.",
  },
  {
    key: RoleKey.ADMIN,
    name: "Portal Admin",
    isApprover: false,
    description: "Manages portal access and user provisioning.",
  },
];

const leaveTypes = [
  {
    code: "EL",
    name: "Earned Leave",
    category: "Earned",
    maxDaysPerRequest: 60,
    requiresOfficeOrder: false,
    requiresDirectorApproval: false,
    requiresAccountsReview: false,
    requiresTravelPermission: false,
    description: "Standard earned leave with optional station leave request.",
  },
  {
    code: "SL",
    name: "Station Leave",
    category: "Station",
    maxDaysPerRequest: 15,
    requiresOfficeOrder: false,
    requiresDirectorApproval: false,
    requiresAccountsReview: false,
    requiresTravelPermission: false,
    description: "Short duration travel outside Roopnagar station.",
  },
  {
    code: "JR",
    name: "Joining Report",
    category: "Post Leave",
    maxDaysPerRequest: null,
    requiresOfficeOrder: false,
    requiresDirectorApproval: false,
    requiresAccountsReview: false,
    requiresTravelPermission: false,
    description: "Report resumption after sanctioned leave.",
  },
  {
    code: "EXIN",
    name: "Leave for Ex-India Visit",
    category: "Foreign Travel",
    maxDaysPerRequest: 90,
    requiresOfficeOrder: true,
    requiresDirectorApproval: true,
    requiresAccountsReview: false,
    requiresTravelPermission: true,
    description: "Faculty travel outside India for academic work.",
  },
  {
    code: "LTC",
    name: "LTC Claim",
    category: "LTC",
    maxDaysPerRequest: 30,
    requiresOfficeOrder: true,
    requiresDirectorApproval: false,
    requiresAccountsReview: true,
    requiresTravelPermission: true,
    description: "Leave Travel Concession workflow with Accounts check.",
  },
  {
    code: "AIR",
    name: "Air India Exemption",
    category: "Travel Permission",
    maxDaysPerRequest: null,
    requiresOfficeOrder: true,
    requiresDirectorApproval: true,
    requiresAccountsReview: true,
    requiresTravelPermission: true,
    description: "Permission to fly airlines other than Air India.",
  },
];

const userSeeds = [
  {
    key: "faculty",
    name: "Dr. Aditi Sharma",
    email: emailAlias("fac1"),
    designation: "Associate Professor",
    employeeCode: "IITRPR-F001",
    departmentCode: "CSE",
    role: RoleKey.FACULTY,
    isTeaching: true,
    reportsToKey: "hod",
  },
  {
    key: "hod",
    name: "Prof. R. Mehta",
    email: emailAlias("hod1"),
    designation: "HoD, CSE",
    employeeCode: "IITRPR-HOD01",
    departmentCode: "CSE",
    role: RoleKey.HOD,
    isTeaching: true,
    associateKey: "associatehod",
  },
  {
    key: "associatehod",
    name: "Dr. T. Narang",
    email: emailAlias("assoc1"),
    designation: "Associate HoD",
    employeeCode: "IITRPR-AHOD01",
    departmentCode: "CSE",
    role: RoleKey.ASSOCIATE_HOD,
    isTeaching: true,
    reportsToKey: "hod",
  },
  {
    key: "dean",
    name: "Prof. K. Gupta",
    email: emailAlias("dean1"),
    designation: "Dean Student Affairs",
    employeeCode: "IITRPR-DEAN01",
    departmentCode: "ESTAB",
    role: RoleKey.DEAN,
    isTeaching: true,
    reportsToKey: "director",
  },
  {
    key: "registrar",
    name: "Shri P. Kumar",
    email: emailAlias("reg1"),
    designation: "Registrar",
    employeeCode: "IITRPR-REG01",
    departmentCode: "ESTAB",
    role: RoleKey.REGISTRAR,
    reportsToKey: "director",
  },
  {
    key: "accounts",
    name: "Ms. S. Aggarwal",
    email: emailAlias("acc1"),
    designation: "Accounts Officer",
    employeeCode: "IITRPR-ACC01",
    departmentCode: "ACCTS",
    role: RoleKey.ACCOUNTS,
    reportsToKey: "registrar",
  },
  {
    key: "establishment",
    name: "Mr. A. Bansal",
    email: emailAlias("est1"),
    designation: "Establishment Officer",
    employeeCode: "IITRPR-EST01",
    departmentCode: "ESTAB",
    role: RoleKey.ESTABLISHMENT,
    reportsToKey: "registrar",
  },
  {
    key: "director",
    name: "Prof. I. Menon",
    email: emailAlias("dir1"),
    designation: "Director",
    employeeCode: "IITRPR-DIR01",
    departmentCode: "DIR",
    role: RoleKey.DIRECTOR,
  },
  {
    key: "staff",
    name: "Ms. Neha Dahiya",
    email: emailAlias("staff1"),
    designation: "Senior Assistant",
    employeeCode: "IITRPR-S001",
    departmentCode: "ESTAB",
    role: RoleKey.STAFF,
    reportsToKey: "establishment",
  },
  {
    key: "admin",
    name: "Portal Admin",
    email: "2023csb1288+admin@iitrpr.ac.in",
    designation: "Clerical Admin",
    employeeCode: "IITRPR-ADM01",
    departmentCode: "ESTAB",
    role: RoleKey.ADMIN,
  },
  {
    key: "admin2",
    name: "Portal Admin 2",
    email: "2023csb1296+admin@iitrpr.ac.in",
    designation: "Clerical Admin",
    employeeCode: "IITRPR-ADM02",
    departmentCode: "ESTAB",
    role: RoleKey.ADMIN,
  },
];

async function main() {
  const departmentRecords = await Promise.all(
    departments.map((dept) =>
      prisma.department.upsert({
        where: { code: dept.code },
        update: {
          name: dept.name,
          description: dept.description,
          type: dept.type,
          isActive: true,
        },
        create: {
          ...dept,
          isActive: true,
        },
      }),
    ),
  );
  const departmentMap = Object.fromEntries(
    departmentRecords.map((dept) => [dept.code, dept]),
  );

  const roleRecords = await Promise.all(
    roles.map((role) =>
      prisma.role.upsert({
        where: { key: role.key },
        update: {
          name: role.name,
          description: role.description,
          isApprover: role.isApprover,
        },
        create: {
          ...role,
          description: role.description ?? null,
        },
      }),
    ),
  );
  const roleMap = Object.fromEntries(
    roleRecords.map((role) => [role.key, role]),
  );

  const userMap: Record<string, { id: string; email: string }> = {};
  for (const seed of userSeeds) {
    const where = seed.employeeCode
      ? { employeeCode: seed.employeeCode }
      : { email: seed.email };

    const created = await prisma.user.upsert({
      where,
      update: {
        name: seed.name,
        designation: seed.designation,
        departmentId: seed.departmentCode
          ? departmentMap[seed.departmentCode]?.id
          : null,
        roleId: roleMap[seed.role].id,
        isTeaching: seed.isTeaching ?? false,
        employeeCode: seed.employeeCode,
        email: seed.email,
      },
      create: {
        email: seed.email,
        name: seed.name,
        designation: seed.designation,
        employeeCode: seed.employeeCode,
        departmentId: seed.departmentCode
          ? departmentMap[seed.departmentCode]?.id
          : null,
        roleId: roleMap[seed.role].id,
        isTeaching: seed.isTeaching ?? false,
      },
    });

    userMap[seed.key] = { id: created.id, email: created.email };
  }

  for (const seed of userSeeds) {
    if (!seed.reportsToKey && !seed.associateKey) continue;

    await prisma.user.update({
      where: { email: seed.email },
      data: {
        reportsToId: seed.reportsToKey
          ? (userMap[seed.reportsToKey]?.id ?? null)
          : null,
        associateApproverId: seed.associateKey
          ? (userMap[seed.associateKey]?.id ?? null)
          : null,
      },
    });
  }

  const leaveTypeRecords = await Promise.all(
    leaveTypes.map((type) =>
      prisma.leaveType.upsert({
        where: { code: type.code },
        update: type,
        create: type,
      }),
    ),
  );
  const leaveTypeMap = Object.fromEntries(
    leaveTypeRecords.map((lt) => [lt.code, lt]),
  );

  const currentYearStart = startOfYear(new Date());
  const facultyUser = userMap["faculty"];
  const earnedLeave = leaveTypeMap["EL"];

  if (!facultyUser || !earnedLeave) {
    throw new Error(
      "Seed prerequisites missing: ensure faculty user and EL leave type exist.",
    );
  }

  await prisma.leaveBalance.upsert({
    where: {
      userId_leaveTypeId_periodStart: {
        userId: facultyUser.id,
        leaveTypeId: earnedLeave.id,
        periodStart: currentYearStart,
      },
    },
    update: {
      totalAllocated: 60,
      totalConsumed: 12,
    },
    create: {
      userId: facultyUser.id,
      leaveTypeId: earnedLeave.id,
      totalAllocated: 60,
      totalConsumed: 8,
      totalEncashed: 0,
      periodStart: currentYearStart,
      periodEnd: addDays(currentYearStart, 364),
    },
  });

  const referenceCode = "EL-2026-0001";
  const leaveStart = addDays(new Date(), 14);
  const leaveEnd = addDays(leaveStart, 4);
  const hodUser = userMap["hod"];
  const deanUser = userMap["dean"];
  const establishmentUser = userMap["establishment"];

  if (!hodUser || !deanUser || !establishmentUser) {
    throw new Error(
      "Seed prerequisites missing: approver accounts were not created.",
    );
  }

  await prisma.leaveApplication.upsert({
    where: { referenceCode },
    update: {},
    create: {
      referenceCode,
      applicantId: facultyUser.id,
      leaveTypeId: earnedLeave.id,
      startDate: leaveStart,
      endDate: leaveEnd,
      totalDays: 5,
      status: LeaveStatus.UNDER_REVIEW,
      purpose: "Deliver invited lectures at IIT Madras and industry meetings.",
      destination: "Chennai",
      stationLeave: true,
      contactDuringLeave: "+91 98765 43210",
      accountsClearanceNeeded: false,
      directorApprovalNeeded: false,
      submittedAt: new Date(),
      metadata: {
        itinerary: "Ropar → Delhi → Chennai",
        logistics: "Institute funded",
      },
      approvalSteps: {
        create: [
          {
            sequence: 1,
            actor: WorkflowActor.HOD,
            status: ApprovalStatus.APPROVED,
            remarks: "Approved. Assign lectures to Dr. Narang.",
            assignedToId: hodUser.id,
            actedById: hodUser.id,
            actedAt: addDays(new Date(), -1),
          },
          {
            sequence: 2,
            actor: WorkflowActor.DEAN,
            status: ApprovalStatus.IN_REVIEW,
            assignedToId: deanUser.id,
            dueAt: addDays(new Date(), 2),
          },
          {
            sequence: 3,
            actor: WorkflowActor.ESTABLISHMENT,
            status: ApprovalStatus.PENDING,
            assignedToId: establishmentUser.id,
            dueAt: addDays(new Date(), 5),
          },
        ],
      },
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: facultyUser.id,
        title: "Leave request submitted",
        body: "Your earned leave request EL-2026-0001 is awaiting Dean approval.",
        type: "LEAVE",
      },
      {
        userId: userMap["dean"].id,
        title: "Approval pending",
        body: "Earned Leave EL-2026-0001 needs your review before 48 hours.",
        type: "APPROVAL",
      },
    ],
    skipDuplicates: true,
  });

  console.info("🌿 Prisma seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
