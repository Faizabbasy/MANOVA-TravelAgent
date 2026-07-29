<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import {
  ChevronRight, Edit, Share2, MoreHorizontal,
  CheckCircle2, Clock, Circle, Eye, AlertTriangle,
  DollarSign, Users, Calendar, TrendingUp, Target,
  FileText, FileSpreadsheet, ImageIcon, File, Download, Upload,
  Layers, LayoutGrid, ListTodo, Milestone, Receipt, FolderOpen, Activity,
  Plus, X, TrendingDown, ArrowUpRight, Wallet, Tag, Building,
  MessageSquare, Send, Hash, ChevronDown, GripVertical,
} from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { VueDraggable } from 'vue-draggable-plus'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  name: string; role: string; avatar: string; initials: string
  utilization: number; tasksAssigned: number
}
interface Subtask {
  id: string; title: string; done: boolean
}
interface TaskComment {
  id: number; author: string; avatar: string; initials: string
  text: string; time: string
}
interface Task {
  id: string; title: string
  status: 'todo' | 'in-progress' | 'review' | 'done'
  priority: 'critical' | 'high' | 'medium' | 'low'
  assignee: { name: string; avatar: string; initials: string }
  dueDate: string
  description?: string
  subtasks?: Subtask[]
  comments?: TaskComment[]
  labels?: string[]
}
interface Milestone {
  id: string; title: string; date: string
  status: 'done' | 'in-progress' | 'upcoming'
}
interface Activity {
  id: number
  user: { name: string; avatar: string; initials: string }
  action: string; target: string; time: string; iconColor: string
}
interface BudgetPhase { phase: string; budget: number; spent: number }
interface ProjectFile {
  id: number; name: string
  type: 'pdf' | 'fig' | 'xlsx' | 'docx' | 'png'
  size: string; uploadedBy: string; date: string
}
interface Risk {
  id: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string; description: string; owner: string
  status: 'open' | 'mitigated' | 'closed'
}
interface Expense {
  id: number; date: string
  category: string; description: string
  amount: number; addedBy: string
}
interface ProjectDetail {
  id: string; name: string; description: string; objectives: string[]
  client: string; pm: string; department: string; category: string
  status: 'in-progress' | 'at-risk' | 'planning' | 'completed'
  priority: 'critical' | 'high' | 'medium' | 'low'
  healthScore: number; contractValue: number; budget: number; spent: number; progress: number
  startDate: string; dueDate: string
  team: TeamMember[]; tasks: Task[]; milestones: Milestone[]
  activities: Activity[]; budgetPhases: BudgetPhase[]
  files: ProjectFile[]; risks: Risk[]; expenses: Expense[]
}

// ─── Avatars shorthand ────────────────────────────────────────────────────────

const AVT = {
  SC: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=32&h=32&fit=crop&crop=face',
  MJ: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face',
  ED: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face',
  AT: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face',
  LW: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=32&h=32&fit=crop&crop=face',
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const projectData: Record<string, ProjectDetail> = {
  'PRJ-001': {
    id: 'PRJ-001',
    name: 'E-commerce Platform Redesign',
    description: 'Complete redesign of the shopping experience with modern UI/UX patterns, improved conversion funnel, and mobile-first responsive design. The project encompasses a full visual overhaul and technical re-architecture.',
    objectives: [
      'Redesign product listing and detail pages with new component library',
      'Implement new checkout flow reducing steps from 5 to 3',
      'Integrate headless CMS for marketing content management',
      'Achieve Core Web Vitals performance score above 90',
      'Deliver mobile app (iOS + Android) via React Native',
    ],
    client: 'TechCorp Inc.', pm: 'Emily Davis', department: 'Product', category: 'UI/UX Redesign',
    status: 'in-progress', priority: 'high', healthScore: 82,
    contractValue: 58000, budget: 45000, spent: 38500, progress: 72,
    startDate: 'Nov 1, 2024', dueDate: 'Feb 15, 2025',
    team: [
      { name: 'Sarah Chen', role: 'Lead Designer', avatar: AVT.SC, initials: 'SC', utilization: 92, tasksAssigned: 8 },
      { name: 'Mike Johnson', role: 'Senior Developer', avatar: AVT.MJ, initials: 'MJ', utilization: 85, tasksAssigned: 12 },
      { name: 'Emily Davis', role: 'Project Manager', avatar: AVT.ED, initials: 'ED', utilization: 70, tasksAssigned: 5 },
    ],
    tasks: [
      {
        id: 'T-01', title: 'Homepage hero redesign', status: 'done', priority: 'high',
        assignee: { name: 'Sarah Chen', avatar: AVT.SC, initials: 'SC' }, dueDate: 'Dec 10, 2024',
        description: 'Redesign the homepage hero section with new brand visuals, animated headline, and CTA buttons aligned with the new design system.',
        labels: ['design', 'frontend'],
        subtasks: [
          { id: 'ST-01', title: 'Create hero layout variants', done: true },
          { id: 'ST-02', title: 'Implement animation on headline', done: true },
          { id: 'ST-03', title: 'Mobile breakpoint adjustments', done: true },
        ],
        comments: [
          { id: 1, author: 'Emily Davis', avatar: AVT.ED, initials: 'ED', text: 'Client approved the v3 variant. Proceed with implementation.', time: 'Dec 8, 2024' },
        ],
      },
      {
        id: 'T-02', title: 'Product listing page', status: 'done', priority: 'high',
        assignee: { name: 'Sarah Chen', avatar: AVT.SC, initials: 'SC' }, dueDate: 'Dec 20, 2024',
        description: 'Build the product grid with filter sidebar, sorting controls, and lazy-loaded images. Support list and grid view toggle.',
        labels: ['design', 'frontend'],
        subtasks: [
          { id: 'ST-01', title: 'Filter sidebar component', done: true },
          { id: 'ST-02', title: 'Product card component', done: true },
          { id: 'ST-03', title: 'Grid / list view toggle', done: true },
          { id: 'ST-04', title: 'Pagination component', done: true },
        ],
        comments: [],
      },
      {
        id: 'T-03', title: 'Design system documentation', status: 'done', priority: 'medium',
        assignee: { name: 'Sarah Chen', avatar: AVT.SC, initials: 'SC' }, dueDate: 'Dec 28, 2024',
        description: 'Document all design tokens, components, and usage guidelines in Storybook. Include do/don\'t examples for each component.',
        labels: ['design', 'docs'],
        subtasks: [
          { id: 'ST-01', title: 'Color tokens page', done: true },
          { id: 'ST-02', title: 'Typography specimens', done: true },
          { id: 'ST-03', title: 'Component stories (Button, Input, Card)', done: true },
        ],
        comments: [],
      },
      {
        id: 'T-04', title: 'API endpoint architecture', status: 'done', priority: 'high',
        assignee: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, dueDate: 'Jan 5, 2025',
        description: 'Design and document the REST API architecture for product catalog, cart, and order endpoints. Include OpenAPI spec.',
        labels: ['backend'],
        subtasks: [
          { id: 'ST-01', title: 'OpenAPI spec draft', done: true },
          { id: 'ST-02', title: 'Auth middleware setup', done: true },
          { id: 'ST-03', title: 'Rate limiting configuration', done: true },
        ],
        comments: [
          { id: 1, author: 'Emily Davis', avatar: AVT.ED, initials: 'ED', text: 'Reviewed and approved. Good to proceed with implementation.', time: 'Jan 4, 2025' },
        ],
      },
      {
        id: 'T-05', title: 'Checkout flow implementation', status: 'in-progress', priority: 'critical',
        assignee: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, dueDate: 'Jan 25, 2025',
        description: 'Implement the 3-step checkout flow (Cart → Shipping → Payment) with form validation, address autocomplete, and order summary sidebar. Must support guest checkout.',
        labels: ['frontend', 'critical-path'],
        subtasks: [
          { id: 'ST-01', title: 'Cart summary component', done: true },
          { id: 'ST-02', title: 'Shipping address form with validation', done: true },
          { id: 'ST-03', title: 'Payment method selector UI', done: false },
          { id: 'ST-04', title: 'Order confirmation screen', done: false },
          { id: 'ST-05', title: 'Guest checkout flow', done: false },
        ],
        comments: [
          { id: 1, author: 'Emily Davis', avatar: AVT.ED, initials: 'ED', text: 'Please ensure address autocomplete works for international addresses too.', time: '2 days ago' },
          { id: 2, author: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ', text: 'Using Google Places API — covers 180+ countries. Will have a PR up by tomorrow.', time: '1 day ago' },
        ],
      },
      {
        id: 'T-06', title: 'Payment gateway integration', status: 'in-progress', priority: 'critical',
        assignee: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, dueDate: 'Feb 1, 2025',
        description: 'Integrate Stripe as primary payment provider with PayPal as fallback. Handle webhooks for payment confirmation, refunds, and failed transactions.',
        labels: ['backend', 'critical-path'],
        subtasks: [
          { id: 'ST-01', title: 'Stripe SDK setup', done: true },
          { id: 'ST-02', title: 'Payment intent flow', done: false },
          { id: 'ST-03', title: 'Webhook handler', done: false },
          { id: 'ST-04', title: 'PayPal fallback integration', done: false },
          { id: 'ST-05', title: 'Refund flow implementation', done: false },
        ],
        comments: [
          { id: 1, author: 'Emily Davis', avatar: AVT.ED, initials: 'ED', text: 'Client flagged that Stripe had outages last quarter. Make sure we have the PayPal fallback solid.', time: '3 days ago' },
        ],
      },
      {
        id: 'T-07', title: 'Mobile responsive QA testing', status: 'review', priority: 'high',
        assignee: { name: 'Emily Davis', avatar: AVT.ED, initials: 'ED' }, dueDate: 'Feb 5, 2025',
        description: 'Perform cross-browser and cross-device QA on iPhone 12/14, Samsung S23, and iPad. Test all major flows: browse, cart, checkout.',
        labels: ['qa'],
        subtasks: [
          { id: 'ST-01', title: 'iPhone 12/14 testing', done: true },
          { id: 'ST-02', title: 'Samsung S23 testing', done: true },
          { id: 'ST-03', title: 'iPad landscape/portrait testing', done: false },
          { id: 'ST-04', title: 'Document bugs in Linear', done: false },
        ],
        comments: [
          { id: 1, author: 'Sarah Chen', avatar: AVT.SC, initials: 'SC', text: 'Found a layout bug on the cart page on iPhone SE. Added to Linear as P1.', time: '5 hours ago' },
          { id: 2, author: 'Emily Davis', avatar: AVT.ED, initials: 'ED', text: 'Acknowledged. Will fix before marking this as done.', time: '4 hours ago' },
        ],
      },
      {
        id: 'T-08', title: 'Performance optimization', status: 'todo', priority: 'medium',
        assignee: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, dueDate: 'Feb 10, 2025',
        description: 'Achieve Lighthouse score >90 on all pages. Focus on image optimization (WebP + lazy loading), bundle splitting, and critical CSS inlining.',
        labels: ['frontend', 'infra'],
        subtasks: [
          { id: 'ST-01', title: 'Audit current Lighthouse scores', done: false },
          { id: 'ST-02', title: 'Image optimization pass (WebP conversion)', done: false },
          { id: 'ST-03', title: 'Bundle analysis + code splitting', done: false },
          { id: 'ST-04', title: 'Critical CSS extraction', done: false },
        ],
        comments: [],
      },
      {
        id: 'T-09', title: 'CMS content migration', status: 'todo', priority: 'medium',
        assignee: { name: 'Sarah Chen', avatar: AVT.SC, initials: 'SC' }, dueDate: 'Feb 12, 2025',
        description: 'Migrate existing product content and marketing pages from the legacy CMS to the new headless Contentful setup. Map content types and validate all entries post-migration.',
        labels: ['backend', 'docs'],
        subtasks: [
          { id: 'ST-01', title: 'Audit legacy CMS content inventory', done: false },
          { id: 'ST-02', title: 'Map content types to Contentful schema', done: false },
          { id: 'ST-03', title: 'Migrate product catalog entries', done: false },
          { id: 'ST-04', title: 'Validate all entries post-migration', done: false },
        ],
        comments: [],
      },
    ],
    milestones: [
      { id: 'M-01', title: 'Discovery', date: 'Nov 15, 2024', status: 'done' },
      { id: 'M-02', title: 'Design', date: 'Dec 5, 2024', status: 'done' },
      { id: 'M-03', title: 'Alpha Build', date: 'Jan 10, 2025', status: 'done' },
      { id: 'M-04', title: 'Integration', date: 'Jan 28, 2025', status: 'in-progress' },
      { id: 'M-05', title: 'UAT', date: 'Feb 8, 2025', status: 'upcoming' },
      { id: 'M-06', title: 'Launch', date: 'Feb 15, 2025', status: 'upcoming' },
    ],
    activities: [
      { id: 1, user: { name: 'Sarah Chen', avatar: AVT.SC, initials: 'SC' }, action: 'uploaded', target: 'Design_v3.fig', time: '5 min ago', iconColor: 'text-primary bg-primary/10' },
      { id: 2, user: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, action: 'completed', target: 'API auth module', time: '1 hour ago', iconColor: 'text-success bg-success/10' },
      { id: 3, user: { name: 'Emily Davis', avatar: AVT.ED, initials: 'ED' }, action: 'commented on', target: 'Checkout Flow Review', time: '3 hours ago', iconColor: 'text-warning bg-warning/10' },
      { id: 4, user: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, action: 'started', target: 'Payment gateway integration', time: 'Yesterday', iconColor: 'text-chart-4 bg-chart-4/10' },
      { id: 5, user: { name: 'Sarah Chen', avatar: AVT.SC, initials: 'SC' }, action: 'closed milestone', target: 'Frontend Alpha Build', time: '2 days ago', iconColor: 'text-chart-5 bg-chart-5/10' },
    ],
    budgetPhases: [
      { phase: 'Discovery', budget: 5000, spent: 4800 },
      { phase: 'Design', budget: 10000, spent: 9200 },
      { phase: 'Development', budget: 22000, spent: 19500 },
      { phase: 'Testing', budget: 5000, spent: 3200 },
      { phase: 'Launch', budget: 3000, spent: 1800 },
    ],
    files: [
      { id: 1, name: 'Design_System_v3.fig', type: 'fig', size: '14.2 MB', uploadedBy: 'Sarah Chen', date: 'Jan 12, 2025' },
      { id: 2, name: 'Project_Brief.pdf', type: 'pdf', size: '2.1 MB', uploadedBy: 'Emily Davis', date: 'Nov 2, 2024' },
      { id: 3, name: 'Budget_Tracker.xlsx', type: 'xlsx', size: '0.8 MB', uploadedBy: 'Emily Davis', date: 'Jan 5, 2025' },
      { id: 4, name: 'API_Documentation.docx', type: 'docx', size: '1.4 MB', uploadedBy: 'Mike Johnson', date: 'Dec 28, 2024' },
      { id: 5, name: 'Prototype_Preview.png', type: 'png', size: '3.7 MB', uploadedBy: 'Sarah Chen', date: 'Jan 8, 2025' },
    ],
    risks: [
      { id: 1, severity: 'high', title: 'Third-party payment API instability', description: 'Stripe API had 2 outages in Q4; fallback provider evaluation needed.', owner: 'Mike Johnson', status: 'open' },
      { id: 2, severity: 'medium', title: 'Client scope creep on mobile nav', description: 'Client requested hamburger redesign outside original scope agreement.', owner: 'Emily Davis', status: 'mitigated' },
      { id: 3, severity: 'low', title: 'Font licensing for CIS markets', description: 'Plus Jakarta Sans requires extended license for certain regions.', owner: 'Sarah Chen', status: 'closed' },
    ],
    expenses: [
      { id: 1, date: 'Nov 5, 2024', category: 'Development', description: 'Backend API development sprint 1', amount: 8500, addedBy: 'Mike Johnson' },
      { id: 2, date: 'Nov 20, 2024', category: 'Design', description: 'UI/UX design system creation', amount: 6200, addedBy: 'Sarah Chen' },
      { id: 3, date: 'Dec 3, 2024', category: 'Software', description: 'Figma Pro + Storybook licenses (3 months)', amount: 480, addedBy: 'Emily Davis' },
      { id: 4, date: 'Dec 15, 2024', category: 'Development', description: 'Frontend development sprint 2', amount: 9500, addedBy: 'Mike Johnson' },
      { id: 5, date: 'Jan 8, 2025', category: 'Infrastructure', description: 'AWS staging environment setup', amount: 1200, addedBy: 'Mike Johnson' },
      { id: 6, date: 'Jan 14, 2025', category: 'Design', description: 'Prototype review & revisions', amount: 3200, addedBy: 'Sarah Chen' },
      { id: 7, date: 'Jan 20, 2025', category: 'Travel', description: 'Client onsite meeting — TechCorp HQ', amount: 620, addedBy: 'Emily Davis' },
    ],
  },
  'PRJ-002': {
    id: 'PRJ-002',
    name: 'Mobile Banking App',
    description: 'iOS and Android banking application with biometric authentication, real-time transaction tracking, and seamless fund transfer capabilities built for the modern mobile-first consumer.',
    objectives: [
      'Build cross-platform iOS and Android app with React Native',
      'Implement biometric (Face ID / fingerprint) authentication',
      'Real-time transaction notifications and balance updates',
      'P2P fund transfer with QR code support',
    ],
    client: 'FinanceFirst', pm: 'Sarah Chen', department: 'Engineering', category: 'Mobile Development',
    status: 'at-risk', priority: 'critical', healthScore: 52,
    contractValue: 110000, budget: 85000, spent: 92000, progress: 85,
    startDate: 'Sep 1, 2024', dueDate: 'Jan 30, 2025',
    team: [
      { name: 'Alex Thompson', role: 'Mobile Lead', avatar: AVT.AT, initials: 'AT', utilization: 98, tasksAssigned: 15 },
      { name: 'Lisa Wong', role: 'Backend Engineer', avatar: AVT.LW, initials: 'LW', utilization: 90, tasksAssigned: 11 },
    ],
    tasks: [
      { id: 'T-01', title: 'Biometric authentication module', status: 'done', priority: 'critical', assignee: { name: 'Alex Thompson', avatar: AVT.AT, initials: 'AT' }, dueDate: 'Oct 15, 2024' },
      { id: 'T-02', title: 'Transaction history screen', status: 'done', priority: 'high', assignee: { name: 'Alex Thompson', avatar: AVT.AT, initials: 'AT' }, dueDate: 'Nov 1, 2024' },
      { id: 'T-03', title: 'App Store submission prep', status: 'review', priority: 'critical', assignee: { name: 'Alex Thompson', avatar: AVT.AT, initials: 'AT' }, dueDate: 'Jan 25, 2025' },
      { id: 'T-04', title: 'Security audit fixes', status: 'in-progress', priority: 'critical', assignee: { name: 'Lisa Wong', avatar: AVT.LW, initials: 'LW' }, dueDate: 'Jan 28, 2025' },
      { id: 'T-05', title: 'Play Store submission', status: 'todo', priority: 'high', assignee: { name: 'Alex Thompson', avatar: AVT.AT, initials: 'AT' }, dueDate: 'Jan 30, 2025' },
    ],
    milestones: [
      { id: 'M-01', title: 'Architecture', date: 'Sep 20, 2024', status: 'done' },
      { id: 'M-02', title: 'MVP Complete', date: 'Nov 30, 2024', status: 'done' },
      { id: 'M-03', title: 'Security Audit', date: 'Jan 15, 2025', status: 'in-progress' },
      { id: 'M-04', title: 'App Launch', date: 'Jan 30, 2025', status: 'upcoming' },
    ],
    activities: [
      { id: 1, user: { name: 'Alex Thompson', avatar: AVT.AT, initials: 'AT' }, action: 'flagged risk', target: 'Budget overrun alert', time: '2 hours ago', iconColor: 'text-destructive bg-destructive/10' },
      { id: 2, user: { name: 'Lisa Wong', avatar: AVT.LW, initials: 'LW' }, action: 'completed', target: 'API rate limiting', time: 'Yesterday', iconColor: 'text-success bg-success/10' },
      { id: 3, user: { name: 'Alex Thompson', avatar: AVT.AT, initials: 'AT' }, action: 'submitted', target: 'TestFlight build v2.1', time: '2 days ago', iconColor: 'text-primary bg-primary/10' },
    ],
    budgetPhases: [
      { phase: 'Discovery', budget: 8000, spent: 8500 },
      { phase: 'Design', budget: 12000, spent: 13200 },
      { phase: 'Development', budget: 50000, spent: 55000 },
      { phase: 'Testing', budget: 10000, spent: 11800 },
      { phase: 'Launch', budget: 5000, spent: 3500 },
    ],
    files: [
      { id: 1, name: 'Mobile_Wireframes.fig', type: 'fig', size: '22.1 MB', uploadedBy: 'Alex Thompson', date: 'Oct 5, 2024' },
      { id: 2, name: 'Security_Audit_Report.pdf', type: 'pdf', size: '5.4 MB', uploadedBy: 'Lisa Wong', date: 'Jan 10, 2025' },
    ],
    risks: [
      { id: 1, severity: 'critical', title: 'Budget exceeded by $7,000', description: 'Scope additions from client led to 8% budget overrun; renegotiation in progress.', owner: 'Sarah Chen', status: 'open' },
      { id: 2, severity: 'high', title: 'App Store review delays', description: 'Apple review times averaging 5-7 days, compressing launch window.', owner: 'Alex Thompson', status: 'open' },
    ],
    expenses: [
      { id: 1, date: 'Sep 10, 2024', category: 'Development', description: 'React Native setup & architecture', amount: 12000, addedBy: 'Alex Thompson' },
      { id: 2, date: 'Oct 1, 2024', category: 'Design', description: 'Mobile UX design sprints', amount: 18000, addedBy: 'Alex Thompson' },
      { id: 3, date: 'Nov 15, 2024', category: 'Development', description: 'Core banking feature development', amount: 32000, addedBy: 'Alex Thompson' },
      { id: 4, date: 'Dec 20, 2024', category: 'Infrastructure', description: 'AWS infrastructure + security setup', amount: 8500, addedBy: 'Lisa Wong' },
      { id: 5, date: 'Jan 5, 2025', category: 'Software', description: 'Security audit tooling licenses', amount: 3200, addedBy: 'Lisa Wong' },
      { id: 6, date: 'Jan 10, 2025', category: 'Other', description: 'External security consultant', amount: 18300, addedBy: 'Sarah Chen' },
    ],
  },
  'PRJ-003': {
    id: 'PRJ-003',
    name: 'Healthcare Portal',
    description: 'Patient management system with appointment scheduling, electronic health records, and telemedicine capabilities built to meet HIPAA compliance standards.',
    objectives: [
      'Develop HIPAA-compliant patient management system',
      'Build appointment scheduling with calendar integration',
      'Implement telemedicine video consultation module',
      'EHR integration with major hospital systems',
    ],
    client: 'MedLife', pm: 'Emily Davis', department: 'Engineering', category: 'Healthcare Tech',
    status: 'in-progress', priority: 'medium', healthScore: 74,
    contractValue: 78000, budget: 62000, spent: 48000, progress: 58,
    startDate: 'Oct 15, 2024', dueDate: 'Mar 20, 2025',
    team: [
      { name: 'Sarah Chen', role: 'Lead Designer', avatar: AVT.SC, initials: 'SC', utilization: 65, tasksAssigned: 6 },
      { name: 'Mike Johnson', role: 'Senior Developer', avatar: AVT.MJ, initials: 'MJ', utilization: 80, tasksAssigned: 9 },
      { name: 'Alex Thompson', role: 'Backend Engineer', avatar: AVT.AT, initials: 'AT', utilization: 75, tasksAssigned: 8 },
      { name: 'Emily Davis', role: 'Project Manager', avatar: AVT.ED, initials: 'ED', utilization: 60, tasksAssigned: 5 },
    ],
    tasks: [
      { id: 'T-01', title: 'Patient onboarding flow', status: 'done', priority: 'high', assignee: { name: 'Sarah Chen', avatar: AVT.SC, initials: 'SC' }, dueDate: 'Nov 20, 2024' },
      { id: 'T-02', title: 'HIPAA compliance review', status: 'done', priority: 'critical', assignee: { name: 'Emily Davis', avatar: AVT.ED, initials: 'ED' }, dueDate: 'Dec 1, 2024' },
      { id: 'T-03', title: 'Appointment scheduling engine', status: 'in-progress', priority: 'high', assignee: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, dueDate: 'Feb 10, 2025' },
      { id: 'T-04', title: 'EHR API integration', status: 'review', priority: 'high', assignee: { name: 'Alex Thompson', avatar: AVT.AT, initials: 'AT' }, dueDate: 'Mar 1, 2025' },
      { id: 'T-05', title: 'Telemedicine video module', status: 'todo', priority: 'medium', assignee: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, dueDate: 'Mar 10, 2025' },
    ],
    milestones: [
      { id: 'M-01', title: 'Compliance', date: 'Nov 15, 2024', status: 'done' },
      { id: 'M-02', title: 'Patient Core', date: 'Jan 5, 2025', status: 'done' },
      { id: 'M-03', title: 'Scheduling', date: 'Feb 15, 2025', status: 'in-progress' },
      { id: 'M-04', title: 'EHR Integration', date: 'Mar 5, 2025', status: 'upcoming' },
      { id: 'M-05', title: 'Launch', date: 'Mar 20, 2025', status: 'upcoming' },
    ],
    activities: [
      { id: 1, user: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, action: 'updated', target: 'Scheduling engine v2', time: '4 hours ago', iconColor: 'text-primary bg-primary/10' },
      { id: 2, user: { name: 'Emily Davis', avatar: AVT.ED, initials: 'ED' }, action: 'approved', target: 'HIPAA audit report', time: 'Yesterday', iconColor: 'text-success bg-success/10' },
    ],
    budgetPhases: [
      { phase: 'Discovery', budget: 7000, spent: 6800 },
      { phase: 'Design', budget: 12000, spent: 10500 },
      { phase: 'Development', budget: 32000, spent: 24500 },
      { phase: 'Testing', budget: 7000, spent: 4200 },
      { phase: 'Launch', budget: 4000, spent: 2000 },
    ],
    files: [
      { id: 1, name: 'HIPAA_Compliance_Docs.pdf', type: 'pdf', size: '8.3 MB', uploadedBy: 'Emily Davis', date: 'Nov 28, 2024' },
      { id: 2, name: 'Portal_Wireframes.fig', type: 'fig', size: '18.7 MB', uploadedBy: 'Sarah Chen', date: 'Nov 10, 2024' },
    ],
    risks: [
      { id: 1, severity: 'high', title: 'EHR vendor API documentation gaps', description: 'Third-party EHR vendor has incomplete API docs, causing integration delays.', owner: 'Alex Thompson', status: 'open' },
      { id: 2, severity: 'medium', title: 'Telemedicine scope expansion', description: 'Client requested group video sessions beyond original 1:1 scope.', owner: 'Emily Davis', status: 'mitigated' },
    ],
    expenses: [
      { id: 1, date: 'Oct 20, 2024', category: 'Development', description: 'HIPAA compliance framework setup', amount: 9500, addedBy: 'Alex Thompson' },
      { id: 2, date: 'Nov 10, 2024', category: 'Design', description: 'Healthcare UX research & wireframing', amount: 8200, addedBy: 'Sarah Chen' },
      { id: 3, date: 'Dec 5, 2024', category: 'Software', description: 'EHR integration middleware licenses', amount: 4800, addedBy: 'Emily Davis' },
      { id: 4, date: 'Jan 12, 2025', category: 'Development', description: 'Scheduling system development', amount: 14500, addedBy: 'Mike Johnson' },
      { id: 5, date: 'Jan 22, 2025', category: 'Infrastructure', description: 'HIPAA-compliant cloud hosting setup', amount: 5200, addedBy: 'Alex Thompson' },
      { id: 6, date: 'Feb 2, 2025', category: 'Other', description: 'External HIPAA compliance audit', amount: 5800, addedBy: 'Emily Davis' },
    ],
  },
  'PRJ-004': {
    id: 'PRJ-004',
    name: 'SaaS Analytics Dashboard',
    description: 'Real-time analytics platform with custom reporting, interactive data visualizations, and role-based access control for enterprise customers.',
    objectives: [
      'Build real-time data streaming pipeline with WebSockets',
      'Create custom report builder with drag-and-drop interface',
      'Implement role-based access control for multi-tenant use',
      'Develop white-label theming for enterprise clients',
    ],
    client: 'DataDriven', pm: 'Mike Johnson', department: 'Product', category: 'Data & Analytics',
    status: 'planning', priority: 'low', healthScore: 90,
    contractValue: 52000, budget: 38000, spent: 5500, progress: 15,
    startDate: 'Jan 15, 2025', dueDate: 'Apr 10, 2025',
    team: [
      { name: 'Lisa Wong', role: 'Full Stack Engineer', avatar: AVT.LW, initials: 'LW', utilization: 40, tasksAssigned: 5 },
    ],
    tasks: [
      { id: 'T-01', title: 'Technical architecture doc', status: 'done', priority: 'high', assignee: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, dueDate: 'Jan 20, 2025' },
      { id: 'T-02', title: 'Data schema design', status: 'done', priority: 'high', assignee: { name: 'Lisa Wong', avatar: AVT.LW, initials: 'LW' }, dueDate: 'Jan 25, 2025' },
      { id: 'T-03', title: 'WebSocket infrastructure setup', status: 'in-progress', priority: 'high', assignee: { name: 'Lisa Wong', avatar: AVT.LW, initials: 'LW' }, dueDate: 'Feb 10, 2025' },
      { id: 'T-04', title: 'UI component library', status: 'review', priority: 'medium', assignee: { name: 'Lisa Wong', avatar: AVT.LW, initials: 'LW' }, dueDate: 'Feb 28, 2025' },
      { id: 'T-05', title: 'Report builder engine', status: 'todo', priority: 'high', assignee: { name: 'Lisa Wong', avatar: AVT.LW, initials: 'LW' }, dueDate: 'Mar 20, 2025' },
    ],
    milestones: [
      { id: 'M-01', title: 'Kickoff', date: 'Jan 15, 2025', status: 'done' },
      { id: 'M-02', title: 'Architecture', date: 'Jan 25, 2025', status: 'done' },
      { id: 'M-03', title: 'Infrastructure', date: 'Feb 15, 2025', status: 'in-progress' },
      { id: 'M-04', title: 'Alpha Build', date: 'Mar 10, 2025', status: 'upcoming' },
      { id: 'M-05', title: 'Beta Launch', date: 'Apr 10, 2025', status: 'upcoming' },
    ],
    activities: [
      { id: 1, user: { name: 'Lisa Wong', avatar: AVT.LW, initials: 'LW' }, action: 'started', target: 'WebSocket infrastructure', time: '1 hour ago', iconColor: 'text-primary bg-primary/10' },
      { id: 2, user: { name: 'Mike Johnson', avatar: AVT.MJ, initials: 'MJ' }, action: 'approved', target: 'Data schema v1.2', time: '3 hours ago', iconColor: 'text-success bg-success/10' },
    ],
    budgetPhases: [
      { phase: 'Discovery', budget: 4000, spent: 3800 },
      { phase: 'Design', budget: 6000, spent: 1700 },
      { phase: 'Development', budget: 22000, spent: 0 },
      { phase: 'Testing', budget: 4000, spent: 0 },
      { phase: 'Launch', budget: 2000, spent: 0 },
    ],
    files: [
      { id: 1, name: 'Technical_Architecture.docx', type: 'docx', size: '3.2 MB', uploadedBy: 'Mike Johnson', date: 'Jan 20, 2025' },
      { id: 2, name: 'Data_Schema_v1.xlsx', type: 'xlsx', size: '1.1 MB', uploadedBy: 'Lisa Wong', date: 'Jan 24, 2025' },
    ],
    risks: [
      { id: 1, severity: 'low', title: 'Tight timeline for report builder', description: 'Report builder complexity may require additional sprint if drag-and-drop proves difficult.', owner: 'Lisa Wong', status: 'open' },
    ],
    expenses: [
      { id: 1, date: 'Jan 16, 2025', category: 'Development', description: 'Architecture & setup sprint', amount: 3800, addedBy: 'Mike Johnson' },
      { id: 2, date: 'Jan 24, 2025', category: 'Software', description: 'Dev tooling & cloud credits', amount: 1700, addedBy: 'Lisa Wong' },
    ],
  },
}

// ─── Route & Project ──────────────────────────────────────────────────────────

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const project = computed(() => projectData[projectId.value])

// ─── Main Tab ─────────────────────────────────────────────────────────────────

type MainTab = 'overview' | 'tasks' | 'timeline' | 'finances' | 'files' | 'activity'
const activeTab = ref<MainTab>('overview')

const tabs: { id: MainTab; label: string; icon: any }[] = [
  { id: 'overview',  label: 'Overview',  icon: LayoutGrid },
  { id: 'tasks',     label: 'Tasks',     icon: ListTodo },
  { id: 'timeline',  label: 'Timeline',  icon: Milestone },
  { id: 'finances',  label: 'Finances',  icon: Receipt },
  { id: 'files',     label: 'Files',     icon: FolderOpen },
  { id: 'activity',  label: 'Activity',  icon: Activity },
]

// ─── Kanban ───────────────────────────────────────────────────────────────────

const kanbanColumns = [
  { key: 'todo',        label: 'To Do',      icon: Circle,       headerClass: 'text-muted-foreground', dotClass: 'bg-muted-foreground' },
  { key: 'in-progress', label: 'In Progress', icon: Clock,        headerClass: 'text-primary',          dotClass: 'bg-primary' },
  { key: 'review',      label: 'Review',      icon: Eye,          headerClass: 'text-warning',          dotClass: 'bg-warning' },
  { key: 'done',        label: 'Done',        icon: CheckCircle2, headerClass: 'text-success',          dotClass: 'bg-success' },
] as const

// Per-column task arrays — enables drag-and-drop + move-to-column
const kanbanTasks = reactive<Record<Task['status'], Task[]>>({
  'todo': [], 'in-progress': [], 'review': [], 'done': []
})

watch(project, (p) => {
  if (!p) return
  const statuses = ['todo', 'in-progress', 'review', 'done'] as const
  statuses.forEach(s => {
    kanbanTasks[s] = p.tasks.filter(t => t.status === s).map(t => ({
      ...t,
      subtasks: t.subtasks?.map(sub => ({ ...sub })) ?? [],
      comments: t.comments ? [...t.comments] : [],
      labels: t.labels ? [...t.labels] : [],
    }))
  })
}, { immediate: true })

const allTasks = computed(() => [
  ...kanbanTasks['todo'],
  ...kanbanTasks['in-progress'],
  ...kanbanTasks['review'],
  ...kanbanTasks['done'],
])

// ─── Task Panel ───────────────────────────────────────────────────────────────

const isTaskPanelOpen = ref(false)

onBeforeRouteLeave(() => {
  isTaskPanelOpen.value = false
})

onUnmounted(() => {
  // Reka UI DialogPortal sets overflow:hidden on body when open.
  // If navigation happens mid-close-animation, cleanup never fires — restore manually.
  document.body.style.overflow = ''
  document.body.style.pointerEvents = ''
  document.body.removeAttribute('data-scroll-locked')
})
const selectedTaskId = ref<string | null>(null)
const selectedTask = computed(() => allTasks.value.find(t => t.id === selectedTaskId.value) ?? null)

const newCommentText = ref('')
const newSubtaskText = ref('')

function openTask(task: Task) {
  selectedTaskId.value = task.id
  isTaskPanelOpen.value = true
}

function moveTask(newStatus: Task['status']) {
  if (!selectedTaskId.value) return
  const statuses = ['todo', 'in-progress', 'review', 'done'] as const
  let task: Task | undefined
  let fromStatus: Task['status'] | undefined
  for (const s of statuses) {
    const idx = kanbanTasks[s].findIndex(t => t.id === selectedTaskId.value)
    if (idx !== -1) { task = kanbanTasks[s][idx]; fromStatus = s; break }
  }
  if (!task || !fromStatus || fromStatus === newStatus) return
  kanbanTasks[fromStatus].splice(kanbanTasks[fromStatus].findIndex(t => t.id === selectedTaskId.value), 1)
  task.status = newStatus
  kanbanTasks[newStatus].push(task)
}

function onKanbanAdd(targetStatus: Task['status'], evt: any) {
  const task = kanbanTasks[targetStatus][evt.newIndex]
  if (task) task.status = targetStatus
}

function toggleSubtask(subtaskId: string) {
  const task = allTasks.value.find(t => t.id === selectedTaskId.value)
  const sub = task?.subtasks?.find(s => s.id === subtaskId)
  if (sub) sub.done = !sub.done
}

function addSubtask() {
  if (!newSubtaskText.value.trim()) return
  const task = allTasks.value.find(t => t.id === selectedTaskId.value)
  if (!task) return
  if (!task.subtasks) task.subtasks = []
  task.subtasks.push({ id: `ST-${Date.now()}`, title: newSubtaskText.value.trim(), done: false })
  newSubtaskText.value = ''
}

function addComment() {
  if (!newCommentText.value.trim()) return
  const task = allTasks.value.find(t => t.id === selectedTaskId.value)
  if (!task) return
  if (!task.comments) task.comments = []
  task.comments.push({
    id: Date.now(),
    author: 'You',
    avatar: AVT.ED,
    initials: 'YO',
    text: newCommentText.value.trim(),
    time: 'Just now',
  })
  newCommentText.value = ''
}

const completedSubtasks = computed(() => selectedTask.value?.subtasks?.filter(s => s.done).length ?? 0)
const totalSubtasks = computed(() => selectedTask.value?.subtasks?.length ?? 0)

function onStatusChange(event: Event) {
  moveTask((event.target as HTMLSelectElement).value as Task['status'])
}

// ─── Finances ─────────────────────────────────────────────────────────────────

const expenseCategories = ['Development', 'Design', 'Software', 'Infrastructure', 'Travel', 'Other']
const showAddExpense = ref(false)
const newExpense = reactive({ date: '', category: 'Development', description: '', amount: '' })
const expenseError = ref('')

const localExpenses = computed(() => project.value?.expenses ?? [])
const extraExpenses = ref<Expense[]>([])
const allExpenses = computed(() => [...localExpenses.value, ...extraExpenses.value])

const totalExpenses = computed(() => allExpenses.value.reduce((s, e) => s + e.amount, 0))
const margin = computed(() => project.value ? project.value.contractValue - totalExpenses.value : 0)
const marginPct = computed(() => project.value ? Math.round((margin.value / project.value.contractValue) * 100) : 0)

const expenseCategoryTotals = computed(() => {
  const map: Record<string, number> = {}
  allExpenses.value.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount })
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})

function addExpense() {
  if (!newExpense.date || !newExpense.description || !newExpense.amount) {
    expenseError.value = 'Please fill in all fields.'
    return
  }
  const amt = parseFloat(newExpense.amount)
  if (isNaN(amt) || amt <= 0) { expenseError.value = 'Enter a valid amount.'; return }
  extraExpenses.value.push({
    id: Date.now(),
    date: newExpense.date,
    category: newExpense.category,
    description: newExpense.description,
    amount: amt,
    addedBy: 'You',
  })
  newExpense.date = ''
  newExpense.category = 'Development'
  newExpense.description = ''
  newExpense.amount = ''
  expenseError.value = ''
  showAddExpense.value = false
}

// ─── Utility computed ─────────────────────────────────────────────────────────

const daysRemaining = computed(() => {
  if (!project.value) return 0
  const due = new Date(project.value.dueDate)
  const now = new Date()
  return Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 86400000))
})

const taskCounts = computed(() => ({
  total: allTasks.value.length,
  done:  kanbanTasks['done'].length,
}))

const healthLabel = computed(() => {
  if (!project.value) return ''
  return project.value.healthScore >= 80 ? 'Healthy' : project.value.healthScore >= 60 ? 'At Risk' : 'Critical'
})
const healthClass = computed(() => {
  if (!project.value) return ''
  return project.value.healthScore >= 80
    ? 'bg-success/10 text-success'
    : project.value.healthScore >= 60
      ? 'bg-warning/10 text-warning'
      : 'bg-destructive/10 text-destructive'
})

// ─── Color configs ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
  'in-progress': { label: 'In Progress', className: 'bg-primary/10 text-primary' },
  'at-risk':     { label: 'At Risk',     className: 'bg-destructive/10 text-destructive' },
  'planning':    { label: 'Planning',    className: 'bg-muted text-muted-foreground' },
  'completed':   { label: 'Completed',   className: 'bg-success/10 text-success' },
}
const priorityConfig: Record<string, { label: string; className: string; borderClass: string }> = {
  critical: { label: 'Critical', className: 'bg-destructive/10 text-destructive', borderClass: 'border-l-destructive' },
  high:     { label: 'High',     className: 'bg-warning/10 text-warning',         borderClass: 'border-l-warning' },
  medium:   { label: 'Medium',   className: 'bg-primary/10 text-primary',         borderClass: 'border-l-primary' },
  low:      { label: 'Low',      className: 'bg-muted text-muted-foreground',     borderClass: 'border-l-border' },
}
const severityConfig: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive',
  high:     'bg-warning/10 text-warning',
  medium:   'bg-primary/10 text-primary',
  low:      'bg-muted text-muted-foreground',
}
const riskStatusConfig: Record<string, string> = {
  open:      'bg-destructive/10 text-destructive',
  mitigated: 'bg-warning/10 text-warning',
  closed:    'bg-success/10 text-success',
}
const fileTypeIcon: Record<string, any> = {
  pdf: FileText, docx: FileText, xlsx: FileSpreadsheet, png: ImageIcon, fig: File,
}
const fileTypeColor: Record<string, string> = {
  pdf:  'text-destructive bg-destructive/10',
  docx: 'text-primary bg-primary/10',
  xlsx: 'text-success bg-success/10',
  png:  'text-chart-4 bg-chart-4/10',
  fig:  'text-chart-5 bg-chart-5/10',
}
const categoryColor: Record<string, string> = {
  Development:    'bg-primary/10 text-primary',
  Design:         'bg-chart-4/10 text-chart-4',
  Software:       'bg-chart-5/10 text-chart-5',
  Infrastructure: 'bg-warning/10 text-warning',
  Travel:         'bg-success/10 text-success',
  Other:          'bg-muted text-muted-foreground',
}
const labelColor: Record<string, string> = {
  'frontend':      'bg-primary/10 text-primary',
  'backend':       'bg-chart-4/10 text-chart-4',
  'critical-path': 'bg-destructive/10 text-destructive',
  'design':        'bg-chart-5/10 text-chart-5',
  'infra':         'bg-warning/10 text-warning',
  'qa':            'bg-success/10 text-success',
  'docs':          'bg-muted text-muted-foreground',
}

const kanbanStatusOptions: { key: Task['status']; label: string; dotClass: string }[] = [
  { key: 'todo',        label: 'To Do',      dotClass: 'bg-muted-foreground' },
  { key: 'in-progress', label: 'In Progress', dotClass: 'bg-primary' },
  { key: 'review',      label: 'Review',      dotClass: 'bg-warning' },
  { key: 'done',        label: 'Done',        dotClass: 'bg-success' },
]

// ─── Budget Bar Chart ─────────────────────────────────────────────────────────

const budgetChartData = ref<any>(null)
const budgetChartOptions = ref<any>(null)

onMounted(async () => {
  await nextTick()
  if (!project.value) return

  const s = getComputedStyle(document.documentElement)
  const fmt = (v: string) => v.trim().replace(/\s+/g, ', ')
  const primaryHSL    = fmt(s.getPropertyValue('--primary'))
  const successHSL    = fmt(s.getPropertyValue('--success'))
  const mutedHSL      = fmt(s.getPropertyValue('--muted-foreground'))
  const cardHSL       = fmt(s.getPropertyValue('--card'))
  const borderHSL     = fmt(s.getPropertyValue('--border'))
  const foregroundHSL = fmt(s.getPropertyValue('--foreground'))

  budgetChartData.value = {
    labels: project.value.budgetPhases.map(p => p.phase),
    datasets: [
      { label: 'Budget', data: project.value.budgetPhases.map(p => p.budget), backgroundColor: `hsla(${primaryHSL}, 0.75)`, borderRadius: 4, borderSkipped: false },
      { label: 'Spent',  data: project.value.budgetPhases.map(p => p.spent),  backgroundColor: `hsla(${successHSL}, 0.75)`,  borderRadius: 4, borderSkipped: false },
    ],
  }

  budgetChartOptions.value = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: `hsl(${cardHSL})`, borderColor: `hsl(${borderHSL})`, borderWidth: 1,
        titleColor: `hsl(${foregroundHSL})`, bodyColor: `hsl(${mutedHSL})`,
        titleFont: { family: 'Plus Jakarta Sans, system-ui, sans-serif', size: 12, weight: '600' },
        bodyFont:  { family: 'Plus Jakarta Sans, system-ui, sans-serif', size: 12 },
        padding: 12,
        callbacks: { label: (ctx: any) => ` $${ctx.parsed.y.toLocaleString()}` },
      },
    },
    scales: {
      x: { border: { display: false }, grid: { display: false }, ticks: { color: `hsl(${mutedHSL})`, font: { size: 12, family: 'Plus Jakarta Sans, system-ui, sans-serif', weight: '500' } } },
      y: { border: { display: false }, grid: { display: false }, ticks: { color: `hsl(${mutedHSL})`, font: { size: 12, family: 'Plus Jakarta Sans, system-ui, sans-serif', weight: '500' }, callback: (v: any) => `$${v / 1000}k` } },
    },
  }
})
</script>

<template>
  <div>
  <div class="space-y-5">

    <!-- Not Found -->
    <div v-if="!project" class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Layers class="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 class="text-xl font-semibold text-foreground mb-2">Project not found</h2>
      <p class="text-sm text-muted-foreground mb-6">The project you're looking for doesn't exist or was removed.</p>
      <NuxtLink to="/projects"><Button variant="outline">Back to Projects</Button></NuxtLink>
    </div>

    <template v-else>

      <!-- ── Header ──────────────────────────────────────────────── -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            <NuxtLink to="/projects" class="hover:text-foreground transition-colors">Projects</NuxtLink>
            <ChevronRight class="h-3.5 w-3.5" />
            <span class="text-foreground font-medium">{{ project.id }}</span>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-2xl font-bold text-foreground">{{ project.name }}</h1>
            <Badge variant="secondary" :class="statusConfig[project.status].className">{{ statusConfig[project.status].label }}</Badge>
            <Badge variant="secondary" :class="priorityConfig[project.priority].className">{{ priorityConfig[project.priority].label }}</Badge>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" class="gap-1.5"><Share2 class="h-4 w-4" />Share</Button>
          <NuxtLink :to="`/projects/${projectId}/edit`">
            <Button size="sm" class="gap-1.5 cursor-pointer"><Edit class="h-4 w-4" />Edit</Button>
          </NuxtLink>
          <Button variant="ghost" size="icon" class="h-9 w-9"><MoreHorizontal class="h-4 w-4" /></Button>
        </div>
      </div>

      <!-- ── Hero Stats ──────────────────────────────────────────── -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</p>
            <div class="p-1.5 rounded-lg bg-primary/10"><TrendingUp class="h-3.5 w-3.5 text-primary" /></div>
          </div>
          <p class="text-2xl font-bold text-foreground">{{ project.progress }}%</p>
          <Progress :model-value="project.progress" class="h-1.5 mt-2" />
        </div>
        <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal Value</p>
            <div class="p-1.5 rounded-lg bg-success/10"><Wallet class="h-3.5 w-3.5 text-success" /></div>
          </div>
          <p class="text-2xl font-bold text-foreground">${{ (project.contractValue / 1000).toFixed(0) }}k</p>
          <p class="text-xs text-muted-foreground mt-1">Budget ${{ (project.budget / 1000).toFixed(0) }}k · {{ Math.round((project.budget / project.contractValue) * 100) }}% allocated</p>
        </div>
        <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tasks</p>
            <div class="p-1.5 rounded-lg bg-warning/10"><Target class="h-3.5 w-3.5 text-warning" /></div>
          </div>
          <p class="text-2xl font-bold text-foreground">{{ taskCounts.done }}<span class="text-base font-medium text-muted-foreground">/{{ taskCounts.total }}</span></p>
          <p class="text-xs text-muted-foreground mt-1">{{ Math.round((taskCounts.done / Math.max(taskCounts.total, 1)) * 100) }}% complete</p>
        </div>
        <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Due In</p>
            <div class="p-1.5 rounded-lg" :class="daysRemaining <= 14 ? 'bg-destructive/10' : 'bg-muted'">
              <Calendar class="h-3.5 w-3.5" :class="daysRemaining <= 14 ? 'text-destructive' : 'text-muted-foreground'" />
            </div>
          </div>
          <p class="text-2xl font-bold" :class="daysRemaining <= 14 ? 'text-destructive' : 'text-foreground'">{{ daysRemaining }}<span class="text-sm font-medium text-muted-foreground"> days</span></p>
          <p class="text-xs text-muted-foreground mt-1">Due {{ project.dueDate }}</p>
        </div>
        <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Team</p>
            <div class="p-1.5 rounded-lg bg-chart-4/10"><Users class="h-3.5 w-3.5 text-chart-4" /></div>
          </div>
          <p class="text-2xl font-bold text-foreground">{{ project.team.length }}</p>
          <p class="text-xs text-muted-foreground mt-1">{{ project.team.length === 1 ? 'member' : 'members' }} assigned</p>
        </div>
      </div>

      <!-- ── Milestone Stepper ───────────────────────────────────── -->
      <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in overflow-x-auto">
        <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Project Phases</p>
        <div class="flex items-start min-w-max">
          <template v-for="(ms, i) in project.milestones" :key="ms.id">
            <div class="flex flex-col items-center" style="min-width:96px">
              <!-- Circle -->
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all"
                :class="ms.status === 'done'
                  ? 'bg-success border-success text-white'
                  : ms.status === 'in-progress'
                    ? 'bg-primary border-primary text-white shadow-[0_0_0_4px] shadow-primary/20'
                    : 'bg-card border-border text-muted-foreground'"
              >
                <CheckCircle2 v-if="ms.status === 'done'" class="h-4 w-4" />
                <Clock v-else-if="ms.status === 'in-progress'" class="h-4 w-4" />
                <Circle v-else class="h-4 w-4" />
              </div>
              <!-- Label -->
              <p class="text-xs font-semibold mt-2 text-center leading-tight"
                :class="ms.status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'">
                {{ ms.title }}
              </p>
              <p class="text-[10px] text-muted-foreground mt-0.5 text-center">{{ ms.date }}</p>
              <!-- Status pill -->
              <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1"
                :class="ms.status === 'done' ? 'bg-success/10 text-success' : ms.status === 'in-progress' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'">
                {{ ms.status === 'done' ? 'Done' : ms.status === 'in-progress' ? 'Active' : 'Upcoming' }}
              </span>
            </div>
            <!-- Connector -->
            <div v-if="i < project.milestones.length - 1" class="flex-1 h-0.5 mt-[18px] mx-1 min-w-[24px]"
              :class="ms.status === 'done' ? 'bg-success' : ms.status === 'in-progress' ? 'bg-gradient-to-r from-primary to-border' : 'bg-border'" />
          </template>
        </div>
      </div>

      <!-- ── Tab Navigation ──────────────────────────────────────── -->
      <div class="flex items-center gap-1 border-b border-border">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )"
        >
          <component :is="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- TAB: OVERVIEW                                             -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- LEFT -->
        <div class="lg:col-span-2 space-y-6">

          <!-- Description & Objectives -->
          <div class="bg-card rounded-xl card-shadow animate-fade-in">
            <div class="flex items-center justify-between p-6 border-b border-border">
              <h3 class="text-base font-semibold text-foreground">Project Overview</h3>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full" :class="healthClass">
                {{ healthLabel }} · {{ project.healthScore }}
              </span>
            </div>
            <div class="p-6 space-y-5">
              <p class="text-sm text-muted-foreground leading-relaxed">{{ project.description }}</p>
              <div class="h-px bg-border" />
              <div>
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Objectives & Deliverables</p>
                <ul class="space-y-2">
                  <li v-for="obj in project.objectives" :key="obj" class="flex items-start gap-2.5 text-sm text-foreground">
                    <CheckCircle2 class="h-4 w-4 text-success shrink-0 mt-0.5" />{{ obj }}
                  </li>
                </ul>
              </div>
              <div class="flex flex-wrap gap-2 pt-1">
                <span class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground font-medium">
                  <Calendar class="h-3 w-3" />{{ project.startDate }} → {{ project.dueDate }}
                </span>
                <span class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground font-medium">
                  <Tag class="h-3 w-3" />{{ project.category }}
                </span>
                <span class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground font-medium">
                  <Building class="h-3 w-3" />{{ project.department }}
                </span>
              </div>
            </div>
          </div>

          <!-- Risks -->
          <div class="bg-card rounded-xl card-shadow animate-fade-in">
            <div class="flex items-center justify-between p-6 border-b border-border">
              <h3 class="text-base font-semibold text-foreground">Risks & Issues</h3>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                {{ project.risks.filter(r => r.status === 'open').length }} open
              </span>
            </div>
            <div class="divide-y divide-border">
              <div v-for="risk in project.risks" :key="risk.id" class="flex items-start gap-4 px-6 py-4">
                <div class="w-2 h-2 rounded-full shrink-0 mt-2"
                  :class="risk.severity === 'critical' ? 'bg-destructive' : risk.severity === 'high' ? 'bg-warning' : risk.severity === 'medium' ? 'bg-primary' : 'bg-muted-foreground'" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-foreground">{{ risk.title }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">{{ risk.description }}</p>
                  <p class="text-xs text-muted-foreground mt-1">Owner: <span class="font-medium text-foreground">{{ risk.owner }}</span></p>
                </div>
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge variant="secondary" :class="cn('text-xs', severityConfig[risk.severity])">{{ risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1) }}</Badge>
                  <Badge variant="secondary" :class="cn('text-xs', riskStatusConfig[risk.status])">{{ risk.status.charAt(0).toUpperCase() + risk.status.slice(1) }}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT -->
        <div class="space-y-6">

          <!-- Project Info -->
          <div class="bg-card rounded-xl p-6 card-shadow animate-fade-in space-y-3">
            <h3 class="text-base font-semibold text-foreground">Project Info</h3>
            <dl class="space-y-3">
              <div v-for="(row, i) in [
                { label: 'Client',   value: project.client },
                { label: 'PM',       value: project.pm },
                { label: 'Start',    value: project.startDate },
                { label: 'Deadline', value: project.dueDate },
                { label: 'Dept',     value: project.department },
                { label: 'Category', value: project.category },
              ]" :key="i">
                <div class="flex justify-between items-center">
                  <dt class="text-xs text-muted-foreground">{{ row.label }}</dt>
                  <dd class="text-sm font-medium text-foreground">{{ row.value }}</dd>
                </div>
                <div class="h-px bg-border mt-3" />
              </div>
            </dl>
          </div>

          <!-- Team -->
          <div class="bg-card rounded-xl card-shadow animate-fade-in">
            <div class="flex items-center justify-between p-6 border-b border-border">
              <h3 class="text-base font-semibold text-foreground">Team Members</h3>
              <span class="text-xs text-muted-foreground">{{ project.team.length }} members</span>
            </div>
            <div class="divide-y divide-border">
              <div v-for="m in project.team" :key="m.name" class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <img :src="m.avatar" :alt="m.name" class="w-9 h-9 rounded-full shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-foreground truncate">{{ m.name }}</p>
                    <p class="text-xs text-muted-foreground">{{ m.role }}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-xs font-semibold text-foreground">{{ m.utilization }}%</p>
                    <p class="text-xs text-muted-foreground">{{ m.tasksAssigned }} tasks</p>
                  </div>
                </div>
                <Progress :model-value="m.utilization" class="h-1 mt-3" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- TAB: TASKS (KANBAN)                                       -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'tasks'">
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div v-for="col in kanbanColumns" :key="col.key" class="flex flex-col gap-3">
            <!-- Column Header -->
            <div class="flex items-center gap-2 px-1">
              <div class="w-2 h-2 rounded-full" :class="col.dotClass" />
              <span class="text-sm font-semibold" :class="col.headerClass">{{ col.label }}</span>
              <span class="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {{ kanbanTasks[col.key].length }}
              </span>
            </div>

            <!-- Drop Zone -->
            <VueDraggable
              v-model="kanbanTasks[col.key]"
              group="kanban"
              :animation="200"
              ghost-class="opacity-30"
              drag-class="rotate-1"
              filter=".no-drag"
              class="flex-1 rounded-xl bg-muted/40 p-3 space-y-3 min-h-[200px]"
              @add="(evt) => onKanbanAdd(col.key, evt)"
            >
              <div
                v-for="task in kanbanTasks[col.key]"
                :key="task.id"
                class="bg-card rounded-lg p-4 card-shadow cursor-grab active:cursor-grabbing hover:card-shadow-lg transition-shadow border-l-2"
                :class="priorityConfig[task.priority].borderClass"
                @click="openTask(task)"
              >
                <!-- Priority + Task ID -->
                <div class="flex items-center justify-between mb-2">
                  <Badge variant="secondary" :class="cn('text-xs', priorityConfig[task.priority].className)">
                    {{ priorityConfig[task.priority].label }}
                  </Badge>
                  <span class="text-[10px] text-muted-foreground font-mono">{{ task.id }}</span>
                </div>
                <!-- Title -->
                <p class="text-sm font-medium text-foreground leading-snug mb-3">{{ task.title }}</p>
                <!-- Footer -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <img :src="task.assignee.avatar" :alt="task.assignee.name" class="w-5 h-5 rounded-full" />
                    <span class="text-xs text-muted-foreground">{{ task.assignee.initials }}</span>
                  </div>
                  <div class="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar class="h-3 w-3" />{{ task.dueDate }}
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div class="no-drag" v-if="kanbanTasks[col.key].length === 0">
                <div class="flex flex-col items-center justify-center py-8 text-center">
                  <component :is="col.icon" class="h-6 w-6 text-muted-foreground/30 mb-2" />
                  <p class="text-xs text-muted-foreground/50">Drop tasks here</p>
                </div>
              </div>
            </VueDraggable>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- TAB: TIMELINE                                             -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'timeline'" class="space-y-4">
        <div
          v-for="(ms, i) in project.milestones"
          :key="ms.id"
          class="bg-card rounded-xl p-5 card-shadow flex items-start gap-5 animate-fade-in"
        >
          <!-- Step number + icon -->
          <div class="flex flex-col items-center gap-1 shrink-0">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold text-sm"
              :class="ms.status === 'done'
                ? 'bg-success border-success text-white'
                : ms.status === 'in-progress'
                  ? 'bg-primary border-primary text-white'
                  : 'bg-muted border-border text-muted-foreground'"
            >
              <CheckCircle2 v-if="ms.status === 'done'" class="h-5 w-5" />
              <Clock v-else-if="ms.status === 'in-progress'" class="h-5 w-5" />
              <span v-else class="text-sm font-semibold">{{ i + 1 }}</span>
            </div>
          </div>
          <!-- Content -->
          <div class="flex-1">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <p class="text-sm font-semibold text-foreground">{{ ms.title }}</p>
              <span class="text-xs font-medium px-2.5 py-1 rounded-full"
                :class="ms.status === 'done' ? 'bg-success/10 text-success' : ms.status === 'in-progress' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'">
                {{ ms.status === 'done' ? 'Completed' : ms.status === 'in-progress' ? 'In Progress' : 'Upcoming' }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar class="h-3 w-3" />{{ ms.date }}
            </p>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- TAB: FINANCES                                             -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'finances'" class="space-y-6">

        <!-- Finance KPI Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Contract Value -->
          <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contract Value</p>
              <div class="p-1.5 rounded-lg bg-primary/10"><Wallet class="h-3.5 w-3.5 text-primary" /></div>
            </div>
            <p class="text-2xl font-bold text-foreground">${{ project.contractValue.toLocaleString() }}</p>
            <p class="text-xs text-muted-foreground mt-1">Deal with {{ project.client }}</p>
          </div>
          <!-- Budget -->
          <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Budget</p>
              <div class="p-1.5 rounded-lg bg-chart-4/10"><Target class="h-3.5 w-3.5 text-chart-4" /></div>
            </div>
            <p class="text-2xl font-bold text-foreground">${{ project.budget.toLocaleString() }}</p>
            <p class="text-xs text-muted-foreground mt-1">{{ Math.round((project.budget / project.contractValue) * 100) }}% of contract</p>
          </div>
          <!-- Spent -->
          <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Spent</p>
              <div class="p-1.5 rounded-lg" :class="totalExpenses > project.budget ? 'bg-destructive/10' : 'bg-warning/10'">
                <DollarSign class="h-3.5 w-3.5" :class="totalExpenses > project.budget ? 'text-destructive' : 'text-warning'" />
              </div>
            </div>
            <p class="text-2xl font-bold" :class="totalExpenses > project.budget ? 'text-destructive' : 'text-foreground'">${{ totalExpenses.toLocaleString() }}</p>
            <p class="text-xs text-muted-foreground mt-1">{{ Math.round((totalExpenses / project.budget) * 100) }}% of budget used</p>
          </div>
          <!-- Margin -->
          <div class="bg-card rounded-xl p-5 card-shadow animate-fade-in">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Margin</p>
              <div class="p-1.5 rounded-lg" :class="margin >= 0 ? 'bg-success/10' : 'bg-destructive/10'">
                <component :is="margin >= 0 ? ArrowUpRight : TrendingDown" class="h-3.5 w-3.5" :class="margin >= 0 ? 'text-success' : 'text-destructive'" />
              </div>
            </div>
            <p class="text-2xl font-bold" :class="margin >= 0 ? 'text-success' : 'text-destructive'">${{ Math.abs(margin).toLocaleString() }}</p>
            <p class="text-xs mt-1" :class="margin >= 0 ? 'text-success' : 'text-destructive'">{{ marginPct }}% margin</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <!-- Budget Chart + Breakdown -->
          <div class="lg:col-span-2 space-y-6">

            <!-- Bar Chart -->
            <div class="bg-card rounded-xl card-shadow animate-fade-in">
              <div class="flex items-center justify-between p-6 border-b border-border">
                <h3 class="text-base font-semibold text-foreground">Budget vs Spent by Phase</h3>
                <div class="flex items-center gap-4 text-sm">
                  <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded-sm bg-primary opacity-75" /><span class="text-muted-foreground">Budget</span></div>
                  <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded-sm bg-success opacity-75" /><span class="text-muted-foreground">Spent</span></div>
                </div>
              </div>
              <div class="p-6"><div class="h-[200px]">
                <Bar v-if="budgetChartData && budgetChartOptions" :data="budgetChartData" :options="budgetChartOptions" />
              </div></div>
            </div>

            <!-- Expense Log -->
            <div class="bg-card rounded-xl card-shadow animate-fade-in">
              <div class="flex items-center justify-between p-6 border-b border-border">
                <h3 class="text-base font-semibold text-foreground">Expense Log</h3>
                <Button size="sm" variant="outline" class="gap-1.5 h-8" @click="showAddExpense = !showAddExpense">
                  <component :is="showAddExpense ? X : Plus" class="h-3.5 w-3.5" />
                  {{ showAddExpense ? 'Cancel' : 'Add Expense' }}
                </Button>
              </div>

              <!-- Add Expense Form -->
              <div v-if="showAddExpense" class="p-5 border-b border-border bg-muted/30">
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">New Expense</p>
                <div class="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label class="text-xs text-muted-foreground mb-1 block">Date</label>
                    <input v-model="newExpense.date" type="date"
                      class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label class="text-xs text-muted-foreground mb-1 block">Category</label>
                    <select v-model="newExpense.category"
                      class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                      <option v-for="c in expenseCategories" :key="c" :value="c">{{ c }}</option>
                    </select>
                  </div>
                  <div class="col-span-2">
                    <label class="text-xs text-muted-foreground mb-1 block">Description</label>
                    <input v-model="newExpense.description" type="text" placeholder="What was this expense for?"
                      class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label class="text-xs text-muted-foreground mb-1 block">Amount (USD)</label>
                    <input v-model="newExpense.amount" type="number" min="0" placeholder="0"
                      class="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div class="flex items-end">
                    <Button class="w-full h-9 gap-1.5" @click="addExpense">
                      <Plus class="h-3.5 w-3.5" />Add Expense
                    </Button>
                  </div>
                </div>
                <p v-if="expenseError" class="text-xs text-destructive">{{ expenseError }}</p>
              </div>

              <!-- Table -->
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Date</th>
                      <th class="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Description</th>
                      <th class="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Category</th>
                      <th class="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Amount</th>
                      <th class="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">By</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr v-for="exp in allExpenses" :key="exp.id" class="hover:bg-muted/50 transition-colors">
                      <td class="px-6 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{{ exp.date }}</td>
                      <td class="px-6 py-3.5 text-sm text-foreground">{{ exp.description }}</td>
                      <td class="px-6 py-3.5">
                        <span class="text-xs font-medium px-2 py-0.5 rounded-full" :class="categoryColor[exp.category] ?? 'bg-muted text-muted-foreground'">
                          {{ exp.category }}
                        </span>
                      </td>
                      <td class="px-6 py-3.5 text-sm font-semibold text-foreground text-right whitespace-nowrap">${{ exp.amount.toLocaleString() }}</td>
                      <td class="px-6 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{{ exp.addedBy }}</td>
                    </tr>
                  </tbody>
                  <tfoot class="border-t-2 border-border bg-muted/30">
                    <tr>
                      <td colspan="3" class="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</td>
                      <td class="px-6 py-3 text-sm font-bold text-foreground text-right">${{ totalExpenses.toLocaleString() }}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <!-- Spend by Category -->
          <div class="space-y-6">
            <div class="bg-card rounded-xl p-6 card-shadow animate-fade-in">
              <h3 class="text-base font-semibold text-foreground mb-4">Spend by Category</h3>
              <div class="space-y-3">
                <div v-for="[cat, amt] in expenseCategoryTotals" :key="cat">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-sm text-foreground">{{ cat }}</span>
                    <span class="text-sm font-semibold text-foreground">${{ amt.toLocaleString() }}</span>
                  </div>
                  <div class="h-2 rounded-full bg-muted overflow-hidden">
                    <div class="h-full rounded-full bg-primary transition-all"
                      :style="{ width: `${Math.round((amt / totalExpenses) * 100)}%` }" />
                  </div>
                  <p class="text-xs text-muted-foreground mt-0.5 text-right">{{ Math.round((amt / totalExpenses) * 100) }}%</p>
                </div>
              </div>

              <div class="mt-5 pt-5 border-t border-border space-y-2">
                <div class="flex justify-between text-xs">
                  <span class="text-muted-foreground">Contract Value</span>
                  <span class="font-semibold text-foreground">${{ project.contractValue.toLocaleString() }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-muted-foreground">Total Spent</span>
                  <span class="font-semibold" :class="totalExpenses > project.budget ? 'text-destructive' : 'text-foreground'">${{ totalExpenses.toLocaleString() }}</span>
                </div>
                <div class="flex justify-between text-xs border-t border-border pt-2 mt-2">
                  <span class="text-muted-foreground">Net Margin</span>
                  <span class="font-bold" :class="margin >= 0 ? 'text-success' : 'text-destructive'">
                    {{ margin >= 0 ? '+' : '-' }}${{ Math.abs(margin).toLocaleString() }}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- TAB: FILES                                                -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'files'">
        <div class="bg-card rounded-xl card-shadow animate-fade-in">
          <div class="flex items-center justify-between p-6 border-b border-border">
            <h3 class="text-base font-semibold text-foreground">Files & Documents</h3>
            <Button variant="outline" size="sm" class="gap-1.5 h-8"><Upload class="h-3.5 w-3.5" />Upload</Button>
          </div>
          <div class="divide-y divide-border">
            <div v-for="f in project.files" :key="f.id" class="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" :class="fileTypeColor[f.type]">
                <component :is="fileTypeIcon[f.type]" class="h-5 w-5" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground">{{ f.name }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ f.uploadedBy }} · {{ f.date }}</p>
              </div>
              <span class="text-xs text-muted-foreground">{{ f.size }}</span>
              <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0"><Download class="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- TAB: ACTIVITY                                             -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'activity'">
        <div class="bg-card rounded-xl card-shadow animate-fade-in">
          <div class="p-6 border-b border-border">
            <h3 class="text-base font-semibold text-foreground">Activity Feed</h3>
            <p class="text-sm text-muted-foreground mt-0.5">Latest updates from your team</p>
          </div>
          <div class="divide-y divide-border">
            <div v-for="a in project.activities" :key="a.id" class="flex items-start gap-4 px-6 py-5 hover:bg-muted/50 transition-colors">
              <img :src="a.user.avatar" :alt="a.user.name" class="w-8 h-8 rounded-full shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="text-sm text-foreground leading-relaxed">
                  <span class="font-semibold">{{ a.user.name }}</span>
                  {{ ' ' + a.action + ' ' }}
                  <span class="font-medium">{{ a.target }}</span>
                </p>
                <p class="text-xs text-muted-foreground mt-1">{{ a.time }}</p>
              </div>
              <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" :class="a.iconColor">
                <CheckCircle2 class="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

    </template>
  </div>

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- TASK DETAIL PANEL                                             -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  <Sheet :open="isTaskPanelOpen" @update:open="isTaskPanelOpen = $event">
    <SheetContent side="right" class="sm:max-w-[520px] p-0 flex flex-col gap-0">
      <template v-if="selectedTask">

        <!-- ── Panel Header (sticky) ─────────────────────────────── -->
        <div class="flex items-start gap-3 px-6 py-5 border-b border-border shrink-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {{ projectId }} · {{ selectedTask.id }}
              </span>
              <span v-for="label in selectedTask.labels" :key="label"
                class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                :class="labelColor[label] ?? 'bg-muted text-muted-foreground'">
                {{ label }}
              </span>
            </div>
            <h2 class="text-base font-semibold text-foreground leading-snug pr-8">{{ selectedTask.title }}</h2>
          </div>
        </div>

        <!-- ── Scrollable Body ───────────────────────────────────── -->
        <div class="flex-1 overflow-y-auto">

          <!-- Meta Grid -->
          <div class="grid grid-cols-2 gap-px bg-border border-b border-border">
            <!-- Status -->
            <div class="bg-background px-5 py-3">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Status</p>
              <select
                :value="selectedTask.status"
                @change="onStatusChange"
                class="w-full text-sm font-medium bg-transparent text-foreground focus:outline-none cursor-pointer"
              >
                <option v-for="opt in kanbanStatusOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
              </select>
            </div>
            <!-- Priority -->
            <div class="bg-background px-5 py-3">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Priority</p>
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-medium" :class="priorityConfig[selectedTask.priority].className.split(' ')[1]">
                  {{ priorityConfig[selectedTask.priority].label }}
                </span>
              </div>
            </div>
            <!-- Assignee -->
            <div class="bg-background px-5 py-3">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Assignee</p>
              <div class="flex items-center gap-2">
                <img :src="selectedTask.assignee.avatar" :alt="selectedTask.assignee.name" class="w-5 h-5 rounded-full" />
                <span class="text-sm font-medium text-foreground">{{ selectedTask.assignee.name }}</span>
              </div>
            </div>
            <!-- Due Date -->
            <div class="bg-background px-5 py-3">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Due Date</p>
              <div class="flex items-center gap-1.5">
                <Calendar class="h-3.5 w-3.5 text-muted-foreground" />
                <span class="text-sm font-medium text-foreground">{{ selectedTask.dueDate }}</span>
              </div>
            </div>
          </div>

          <!-- Move to Column -->
          <div class="px-6 py-4 border-b border-border">
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Move to</p>
            <div class="flex gap-2 flex-wrap">
              <button
                v-for="opt in kanbanStatusOptions"
                :key="opt.key"
                @click="moveTask(opt.key)"
                :class="cn(
                  'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
                  selectedTask.status === opt.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                )"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="opt.dotClass" />
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Description -->
          <div class="px-6 py-4 border-b border-border">
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Description</p>
            <p v-if="selectedTask.description" class="text-sm text-foreground leading-relaxed">{{ selectedTask.description }}</p>
            <p v-else class="text-sm text-muted-foreground italic">No description yet.</p>
          </div>

          <!-- Subtasks -->
          <div class="px-6 py-4 border-b border-border">
            <div class="flex items-center justify-between mb-3">
              <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Subtasks
                <span class="ml-1 font-bold text-foreground">{{ completedSubtasks }}/{{ totalSubtasks }}</span>
              </p>
            </div>
            <!-- Progress bar -->
            <div v-if="totalSubtasks > 0" class="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
              <div class="h-full rounded-full bg-primary transition-all"
                :style="{ width: `${totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0}%` }" />
            </div>
            <!-- Checklist -->
            <div class="space-y-2 mb-3">
              <label
                v-for="sub in selectedTask.subtasks"
                :key="sub.id"
                class="flex items-center gap-3 cursor-pointer group"
                @click="toggleSubtask(sub.id)"
              >
                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                  :class="sub.done ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'">
                  <CheckCircle2 v-if="sub.done" class="h-3 w-3 text-white" />
                </div>
                <span class="text-sm transition-colors"
                  :class="sub.done ? 'line-through text-muted-foreground' : 'text-foreground'">
                  {{ sub.title }}
                </span>
              </label>
            </div>
            <!-- Add subtask -->
            <div class="flex items-center gap-2">
              <input
                v-model="newSubtaskText"
                type="text"
                placeholder="Add a subtask..."
                @keydown.enter="addSubtask"
                class="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" variant="outline" class="h-8 px-3 shrink-0" @click="addSubtask">
                <Plus class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <!-- Comments -->
          <div class="px-6 py-4">
            <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Comments
              <span v-if="selectedTask.comments?.length" class="ml-1 font-bold text-foreground">{{ selectedTask.comments.length }}</span>
            </p>

            <!-- Comment thread -->
            <div class="space-y-4 mb-4">
              <div
                v-for="comment in selectedTask.comments"
                :key="comment.id"
                class="flex items-start gap-3"
              >
                <img :src="comment.avatar" :alt="comment.author" class="w-7 h-7 rounded-full shrink-0 mt-0.5" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-2 mb-1">
                    <span class="text-xs font-semibold text-foreground">{{ comment.author }}</span>
                    <span class="text-[10px] text-muted-foreground">{{ comment.time }}</span>
                  </div>
                  <p class="text-sm text-foreground leading-relaxed bg-muted/40 rounded-lg px-3 py-2">{{ comment.text }}</p>
                </div>
              </div>

              <div v-if="!selectedTask.comments?.length" class="flex flex-col items-center py-4 text-center">
                <MessageSquare class="h-6 w-6 text-muted-foreground/30 mb-2" />
                <p class="text-xs text-muted-foreground">No comments yet. Start the conversation.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Comment Input Footer (sticky) ─────────────────────── -->
        <div class="px-6 py-4 border-t border-border bg-background shrink-0">
          <div class="flex items-end gap-3">
            <img :src="AVT.ED" alt="You" class="w-7 h-7 rounded-full shrink-0 mb-0.5" />
            <textarea
              v-model="newCommentText"
              rows="1"
              placeholder="Add a comment..."
              @keydown.enter.prevent="addComment"
              class="flex-1 rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <Button size="icon" class="h-9 w-9 shrink-0" @click="addComment" :disabled="!newCommentText.trim()">
              <Send class="h-4 w-4" />
            </Button>
          </div>
        </div>

      </template>
    </SheetContent>
  </Sheet>
  </div>
</template>
