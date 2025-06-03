// Define interfaces for API responses
export interface Department {
  id: string;
  name: string;
}

export interface Customer {
  name: string;
  email: string;
  internal_id: string | null;
  organization: { id: string; name: string };
}

export interface Situation {
  id: number;
  apply_date: string;
  description: string;
}

export interface Ticket {
  id: string;
  protocol: number;
  subject: string;
  message: string;
  mimetype: string;
  customer: Customer;
  priority: number;
  ticket_type: string;
  work_time: number;
  elapsed_time: number;
  creation_date: string;
  sla: any;
  cost: any;
  evaluation: any;
  first_reply_date: string | null;
  end_date: string | null;
  situation: Situation;
  category: { id: string; name: string };
  department: { id: string; name: string };
  operator: { id: string; name: string };
  status: any;
  parent_ticket_id: string | null;
  schedule_date: string | null;
  active_whatsapp: boolean;
}