#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Phase RC1 + Website — build a responsive marketing website inside the existing Expo app (single codebase) with SEO, cookie banner, newsletter, contact form, and app-store buttons. Also fix GDPR data scrubbing on account deletion."

backend:
  - task: "Contact form endpoint POST /api/contact"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New endpoint. Accepts { name, email, phone?, topic?, message }. Validates length. Persists to db.contact_messages. Public (no auth). Also added GET /api/admin/contact-messages for admins."

  - task: "Newsletter subscribe endpoint POST /api/newsletter/subscribe"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New endpoint accepting { email, source? }. Idempotent — returns { ok:true, already_subscribed:true } for duplicates. Persists to db.newsletter_subscribers. Admin list at /api/admin/newsletter-subscribers."

  - task: "GDPR data scrubbing on account deletion"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Extended POST /api/auth/me/delete: after anonymising the user record, also updates denormalised name fields to 'Deleted user' across jobs (customer_name & assigned_driver_name), bids (driver_name), reviews (from_name), and messages (sender_name)."

frontend:
  - task: "Marketing website — home, how-it-works, services, business, drivers, trust-safety, faq, contact, about pages"
    implemented: true
    working: "NA"
    file: "frontend/app/(marketing)/*.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New (marketing) route group with 9 public pages. Sticky header with mobile menu, comprehensive footer with newsletter signup + social links, cookie consent banner (dismisses via storage). Uses shared theme/tokens; responsive via useResponsive hook."

  - task: "Public routes accessible unauthenticated + Gate updated"
    implemented: true
    working: "NA"
    file: "frontend/app/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Gate now lets unauth users browse (marketing) and settings/legal pages. Web unauth defaults to /(marketing). Native unauth defaults to /(auth)/welcome. Logged-in users can still browse marketing; header shows Go-to-App button."

  - task: "SEO metadata + sitemap.xml + robots.txt"
    implemented: true
    working: "NA"
    file: "frontend/app/+html.tsx, frontend/public/*"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added JSON-LD Organization schema, OG/Twitter defaults, canonical URLs, theme-color, GA4 + Google Search Console verification (env-gated). Per-page SEO via expo-router/head. sitemap.xml + robots.txt in /public."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Contact form endpoint POST /api/contact"
    - "Newsletter subscribe endpoint POST /api/newsletter/subscribe"
    - "GDPR data scrubbing on account deletion"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Phase RC1 Wave 1 complete: marketing website + SEO scaffolding + GDPR anonymisation. Please test the 3 new backend endpoints thoroughly and confirm existing endpoints (auth/jobs/bids/bookings/deposit) still work unchanged. For GDPR: register a customer, post a job, register a driver + submit a bid, complete the flow with a review, then call /auth/me/delete for that customer AND driver — verify all denormalised name fields on jobs/bids/reviews/messages become 'Deleted user'."
    -agent: "testing"
    -message: "Iteration 8 backend testing complete. Wrote /app/backend/tests/test_contact_newsletter_gdpr.py with 11 test cases covering: (1) POST /api/contact — happy path with persistence check via GET /api/admin/contact-messages, 400 on short message, 400 on short name, 422 on invalid email, admin-only guard on listing; (2) POST /api/newsletter/subscribe — happy path, idempotent duplicate (already_subscribed=true), 422 on invalid email, admin-only guard on subscriber listing; (3) POST /api/auth/me/delete — full flow: registered customer 'John Test' + driver 'Jane Driver', admin-approved driver, customer posted bidding job, driver bid, customer accepted bid, customer created booking. Pre-delete verified jobs.customer_name='John Test', jobs.assigned_driver_name='Jane Driver', bids.driver_name='Jane Driver'. Post customer-delete verified user record anonymised (email starts with 'deleted+', name='Deleted user', status='suspended') and jobs.customer_name='Deleted user'. Post driver-delete verified jobs.assigned_driver_name='Deleted user' and bids.driver_name='Deleted user' (queried via admin). All 11/11 tests passed. No issues found. Results: /app/test_reports/pytest/iter8_results.xml. Detailed report: /app/test_reports/iteration_8.json."

