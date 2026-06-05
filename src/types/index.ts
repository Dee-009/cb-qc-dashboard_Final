export interface CbQcLog {
  id: string;
  case_number: string | null;
  technician: string | null;
  team: string | null;
  qc_reject: string | null;
  reject_type: string | null;
  reject_details: string | null;
  comments: string | null;
  reviewed_by: string | null;
  route_back_dept: string | null;
  route_back_details: string | null;
  appointment_reschedule_needed: string | null;
  new_date_days_needed: number | null;
  rush_required: string | null;
  ship_date: string | null;
  time_stamp: string | null;
  is_sample: boolean;
  created_by: string | null;
  created_by_id: string | null;
  created_date: string | null;
  updated_date: string | null;
}

export interface CbMrbCase {
  id: string;
  case_number: string;
  source: string;
  business_unit: string | null;
  product: string | null;
  team: string | null;
  technician: string | null;
  defect_description: string | null;
  reject_type: string | null;
  fault: string | null;
  severity: string;
  status: string;
  disposition: string | null;
  disposition_notes: string | null;
  reviewed_by: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  opened_date: string;
  closed_date: string | null;
  created_date: string | null;
  updated_date: string | null;
  dr_notes: string | null;
  logged_by: string | null;
  ship_date: string | null;
  dr_due_date: string | null;
  needs_expert: boolean | null;
}

export interface CbEmployee {
  id: string;
  name: string;
  team_id: string | null;
  department: string;
  role: string;
  active: boolean;
  email: string | null;
  created_at: string;
}

export interface CbTeam {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}
