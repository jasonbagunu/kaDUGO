import { useNavigate } from "react-router";
import { ShieldOff } from "lucide-react";
import { PrimaryButton } from "../components/ui";
import { getSession, roleLabel } from "../components/RequireAuth";

export default function AccessDenied() {
  const navigate = useNavigate();
  const session = getSession();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-5">
        <ShieldOff className="w-7 h-7 text-red-600" />
      </div>
      <h1 className="text-xl font-bold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
        Access Denied
      </h1>
      <p className="text-sm text-[#6B7280] mt-2 max-w-sm leading-relaxed">
        {session
          ? <>Your account (<strong>{roleLabel(session.role)}</strong>) doesn&apos;t have permission to view this page.</>
          : "You don't have permission to view this page."}
        {" "}If you believe this is a mistake, contact your Super Admin.
      </p>
      <div className="mt-6">
        <PrimaryButton onClick={() => navigate("/")}>Back to Dashboard</PrimaryButton>
      </div>
    </div>
  );
}
