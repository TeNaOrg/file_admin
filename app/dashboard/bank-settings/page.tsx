"use client";

import {useState, useEffect} from "react";
import {Landmark, Save, AlertCircle} from "lucide-react";
import {BankInfo} from "@/lib/types";
import {apiClient} from "@/lib/api";
import toast from "react-hot-toast";

const EMPTY_FORM: BankInfo = {
  bankName: "",
  accountNumber: "",
  accountHolderName: "",
  amount: 0,
  currency: "MNT",
};

export default function BankSettingsPage() {
  const [formData, setFormData] = useState<BankInfo>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchBankInfo();
  }, []);

  const fetchBankInfo = async () => {
    try {
      const response = await apiClient.getBankInfo();
      if (response.success && response.data) {
        setFormData({
          bankName: response.data.bankName || "",
          accountNumber: response.data.accountNumber || "",
          accountHolderName: response.data.accountHolderName || "",
          amount: response.data.amount || 0,
          currency: response.data.currency || "MNT",
        });
      }
    } catch (error) {
      console.error("Error fetching bank info:", error);
      setError("Failed to fetch bank info");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await apiClient.updateBankInfo(formData);
      toast.success("Банкны тохиргоо хадгалагдлаа!");
    } catch (error) {
      const errorMessage = "Тохиргоо хадгалахад алдаа гарлаа";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error updating bank info:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="card space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <div className="p-3 rounded-lg bg-primary-50 mr-4">
          <Landmark className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Банкны тохиргоо
          </h1>
          <p className="text-gray-600 mt-1">
            Премиум төлбөрийн банкны мэдээлэл. Хэрэглэгчид энэ мэдээллийг
            татаж авах хуудсанд харна.
          </p>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      <div className="card max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Банкны нэр
            </label>
            <input
              type="text"
              value={formData.bankName}
              onChange={(e) =>
                setFormData({...formData, bankName: e.target.value})
              }
              className="input-field"
              placeholder="Жишээ: Хаан Банк"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Дансны дугаар
            </label>
            <input
              type="text"
              value={formData.accountNumber}
              onChange={(e) =>
                setFormData({...formData, accountNumber: e.target.value})
              }
              className="input-field"
              placeholder="Жишээ: 5001234567"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Дансны нэр
            </label>
            <input
              type="text"
              value={formData.accountHolderName}
              onChange={(e) =>
                setFormData({...formData, accountHolderName: e.target.value})
              }
              className="input-field"
              placeholder="Дансны эзэмшигчийн нэр"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Дүн
              </label>
              <input
                type="number"
                min={0}
                value={formData.amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: Number(e.target.value),
                  })
                }
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Валют
              </label>
              <input
                type="text"
                value={formData.currency}
                onChange={(e) =>
                  setFormData({...formData, currency: e.target.value})
                }
                className="input-field"
                placeholder="MNT"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Хадгалж байна..." : "Хадгалах"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
