"use client";

import { SessionData } from "@/lib/session";
import { checkReport } from "@/actions";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function PropertyOwner({ accessToken }: { accessToken: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const handlereport = async () => {
    setIsLoading(true);
    const reportData = await checkReport(accessToken)
    download(reportData)
    setIsLoading(false);
  }

  function download(base64Data: string) {
    let link = document.createElement("a")
    link.href = "data:text/plain;base64," + base64Data
    link.download = "report.txt"
    link.click()
  }

  return <div className="flex w-full h-full flex-col  justify-center items-center">
    <h1 className="text-2xl pt-4 pb-4">Download ESG report</h1>
    <Button className="rounded-xl text-base w-50" onClick={handlereport} disabled={isLoading}
      style={{ width: "20em" }}>
      {isLoading ? (
        <div className="flex items-center justify-center">
          <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
        </div>
      ) : (
        "Download report"
      )}
    </Button>
  </div>;
};
