import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LetterTemplateForm from "./shared/LetterTemplateForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function LetterTemplateCreatePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
        <div className="flex items-center gap-3">
           <Button size="icon" variant="ghost" onClick={() => setLocation("/letter-templates")} data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
           </Button>
          <CardTitle>Tambah Template Surat</CardTitle>
        </div>
        </CardHeader>
        <CardContent>
          <LetterTemplateForm
            mode="create"
            onDone={() => setLocation("/letter-templates")}
            onCancel={() => setLocation("/letter-templates")}
          />
        </CardContent>
      </Card>
    </div>
  );
}