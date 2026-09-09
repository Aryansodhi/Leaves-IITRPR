# Digital Leave Management System

## Project Title

**Digital Leave Management System for Faculty and Staff Members**

---

## Project Overview

The Digital Leave Management System is a centralized web-based platform designed to digitize and streamline the leave and institutional form approval process for faculty and staff members.

The system replaces manual paper-based workflows with an automated digital process that supports form submission, role-based approval routing, application tracking, digital signatures, audit logs, report generation, and document generation.

It is designed to handle multiple institutional forms such as:

- Joining Report
- Earned Leave
- Station Leave
- Leave Travel Concession
- Ex-India Leave
- Non-Air India Leave

The platform improves transparency, reduces manual workload, speeds up approvals, and provides better record management across departments.

---

## Problem Statement

The existing manual leave management process involves physical forms, multiple approval levels, repeated data entry, and manual tracking of applications.

This leads to:

- Delays in processing leave applications
- Difficulty in tracking application status
- Increased administrative workload
- Lack of transparency in approval workflows
- Difficulty in maintaining records
- Dependency on manual coordination between departments

To overcome these issues, a digital leave management system is required to automate the complete workflow.

---

## Objectives

The main objectives of the project are:

- To digitize leave and institutional form submission.
- To automate approval workflows based on user roles.
- To provide real-time application tracking.
- To reduce paperwork and manual administrative effort.
- To support secure OTP-based authentication.
- To generate official digital documents in PDF format.
- To maintain audit logs for traceability and accountability.
- To allow administrators to create and manage forms dynamically.

---

## Stakeholders

The major stakeholders of the system are:

| Stakeholder           | Role                                               |
| --------------------- | -------------------------------------------------- |
| Faculty               | Applies for leave and tracks applications          |
| Staff                 | Applies for leave and tracks applications          |
| HoD                   | Approves faculty leave applications                |
| Registrar             | Approves staff leave applications                  |
| Dean                  | Approves HoD/faculty-related applications          |
| Director              | Provides final approval where required             |
| Accounts Section      | Verifies leave balance and financial details       |
| Establishment Section | Handles administrative verification                |
| Admin                 | Manages users, forms, workflows, reports, and logs |
| Technical Team        | Maintains the system and configurations            |

---

# MODULE DOCUMENTATION - USER SIDE

> Each module will be explained separately in the upcoming sections.

## Module 1: Secure Login

i. The system provides two secure login options for users: **Email OTP Login** and **Google OAuth Login**.

ii. In Email OTP Login, the user enters their institute email ID, receives an OTP, and verifies it to access the portal.

iii. In Google OAuth Login, the user can directly sign in using the **Sign in with Google** option without entering an OTP manually.

iv. This module provides fast, secure, and convenient authentication while ensuring that only authorized users can access the system.

## Module 2: User Guidance

i. The system provides an **Overall User Guide** to help users understand the website and its features.

ii. The guide is divided into sections based on different pages and modules of the portal.

iii. Users can select any page from the guide to view information about that specific page.

iv. The guide explains the purpose, usage, and workflow of each selected page.

v. This module improves usability, reduces confusion, and helps users navigate the portal easily.

## Module 3: Applying for Leave Forms

i. Users can apply for six forms: Joining Report, Earned Leave, Station Leave, Leave Travel Concession, Ex-India Leave, and Non-Air India Leave.

ii. After login, users can select the required form from the dashboard and click on the **View** option.

iii. A pop-up box displays important information about the selected form, including instructions, required details, and approval-related information.

iv. Common details such as name, department, designation, email ID, and employee code are automatically filled from the database.

v. Users fill only the remaining form-specific details required for the selected leave form.

vi. After filling the form, users can add their signature using digital signature, typed signature, or uploaded signature options.

vii. OTP verification is performed through the registered email ID to confirm the signature and secure the submission.

viii. After successful OTP verification, users can submit the application.

ix. The submitted application is automatically forwarded to the correct approver based on the user role and form type.

x. Users can track their submitted applications from the **My Applications** section.

xi. The **My Applications** section shows the current status, approval stage, approver details, remarks, and whether the application is approved or rejected.

xii. Users receive email notifications whenever the application status changes.

## Module 4: Approver Side

i. Approvers such as Dean, Registrar, HoD, or other authorized officials can open the **Approvals** page to view pending applications.

ii. The approver can filter applications based on details such as leave type, status, department, role, or date range.

iii. By clicking on **View Details**, the approver can see the complete form submitted by the user along with all filled information.

iv. The approver reviews the application details, attached information, previous approvals, and remarks before taking action.

v. Based on the form requirements, the approver can approve or reject the application and may also need to add remarks, sign, or fill specific fields.

vi. After submission, the application status is updated automatically and forwarded to the next stage or marked as approved/rejected according to the workflow.

## Module 5: Signature Flexibility

i. The system provides three signature options for user convenience: **Digital Signature**, **Uploaded Signature**, and **Typed Signature**.

ii. In the **Digital Signature** option, users can draw their signature directly on the signature pad.

iii. The digital signature strokes are stored as coordinate data and securely hashed, allowing the signature strokes to be replayed for verification.

iv. In the **Uploaded Signature** option, users can upload their signature as an image file.

v. In the **Typed Signature** option, users can type their name or signature text as a digital confirmation.

vi. After selecting any one of the three signature methods, the user must complete OTP verification for an additional security check.

vii. This module improves convenience, flexibility, and security in the form submission and approval process.

## Module 6: Language Translation

i. Each of the six forms is displayed with **English as the primary and fixed language**.

ii. The system also provides a **secondary supporting language** for better user understanding.

iii. Users can change the supporting language using the language selection option available at the top of the form.

iv. Supported secondary languages include Hindi, Punjabi, Telugu, Urdu, and other regional languages.

v. This module improves accessibility and helps users understand form content in their preferred language.

## Module 7: Acting HoD

i. When an HoD is going on leave, they can optionally propose an **Acting HoD** as an alternate arrangement.

ii. The proposed Acting HoD will handle the required responsibilities during the HoD’s leave duration.

iii. The Dean can review and approve the Acting HoD proposal submitted by the HoD.

iv. If required, the Dean can reject the proposal and appoint a different Acting HoD for that period.

v. This module ensures smooth departmental workflow and approval continuity during the HoD’s absence.

# MODULE DOCUMENTATION - ADMIN SIDE

> Each module will be explained separately in the upcoming sections.

## Module 1: Dynamic Form Builder

i. The Admin can create new forms using a simple **drag-and-drop form builder**.

ii. Form elements can be placed and arranged to match the layout of existing offline form copies.

iii. Each form element can be configured based on its required type, such as text, integer, date, checkbox, signature, and other input fields.

iv. A virtual grid-based structure is used to align and style the form elements properly.

v. The Admin can design the form UI according to the required format and institutional needs.

## Module 2: Dynamic Workflow

i. After creating a dynamic form, the Admin can configure the workflow or tasks that should be performed after the user submits the form.

ii. The Admin can click on **Add Task** to create each workflow stage for the selected form.

iii. For every task, the Admin can select the roles or users who are responsible for performing that task.

iv. The Admin can choose the task type, such as **Signature/Verification** or **Form Filling** by the approver.

v. If the task requires the approver to fill another form, the Admin must provide the form ID that needs to be filled for that task.

vi. Multiple tasks can be added in sequence to define the complete approval workflow for the form.

vii. After configuring all workflow tasks, the Admin can select the users or roles who are allowed to view and fill the newly created form.

## Module 3: Audit Page

i. The Admin can use the **Audit Page** to monitor and track all important user and system activities.

ii. The Admin can apply filters such as date, IP address, role, user, and others to view specific logs.

iii. Based on the selected filters, the system displays actions performed by users along with related details.

iv. The audit logs include information such as action performed, host IP address, destination IP address, timestamp, user role, and other activity details.

v. All audit logs are securely stored in the database and cannot be edited or modified by users.

vi. This module helps maintain traceability, security, and accountability by showing which user performed which action in the system.

## Module 4: Statistics Page

i. The Admin can use the **Statistics Page** to view detailed leave-related statistics based on selected filters.

ii. Filters such as date range, leave type, department, role, application status, and period can be applied according to the requirement.

iii. The system displays statistics such as total leave applications, approved applications, rejected applications, pending applications, and other related details.

iv. The Admin can download the generated statistics report in required formats such as JSON or csv for record keeping and analysis.

## Module 5: Track Application

i. The Admin can use the **Track Application** page to search for a specific application using its unique application number.

ii. After entering the application number, the system displays the complete details of the submitted form.

iii. The Admin can view applicant information, form type, submitted details, current status, and approval stage.

iv. The system shows a detailed timeline of all actions performed on the application.

v. The timeline includes who performed each action, what action was taken, remarks, and the exact timestamp, helping the Admin track the complete movement of a specific application.

## Technology Stack

| Technology   | Purpose                              |
| ------------ | ------------------------------------ |
| Next.js      | Full-stack web application framework |
| React.js     | Frontend UI development              |
| Prisma       | ORM for database interaction         |
| PostgreSQL   | Database                             |
| Supabase     | Backend services and authentication  |
| Tailwind CSS | UI styling                           |

---

## Security Features

The system includes the following security features:

- OTP-based authentication
- Institute email domain restriction
- Role-based access control
- Secure session management
- Audit logging
- Digital signature verification
- Controlled access to application data
- Secure database storage

---

## Conclusion

The Digital Leave Management System provides an efficient and transparent solution for managing faculty and staff leave applications.

By digitizing institutional forms, automating approval workflows, enabling application tracking, and maintaining audit logs, the system significantly reduces manual effort and improves administrative productivity.

The platform supports secure authentication, role-based access, dynamic form creation, workflow configuration, digital signatures, and report generation, making it a complete solution for institutional leave management.

---

## Team Members

| Name               | Roll Number |
| ------------------ | ----------- |
| Aryan Sodhi        | 2023CSB1288 |
| Venkata Praneeth J | 2023CSB1296 |
| Shaurya Anant      | 2023CSB1313 |
| Sumit Sharma       | 2023CSB1165 |

---

## Appendix

Additional screenshots, workflow diagrams, database diagrams, and form samples can be added in this section.

---
