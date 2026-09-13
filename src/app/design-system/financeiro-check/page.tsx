import { FinanceDashboard } from "@/components/finance-dashboard";
import { financeFixture } from "./mock";
export default function Page(){return <FinanceDashboard initialData={financeFixture}/>;}
