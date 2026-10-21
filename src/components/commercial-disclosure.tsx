export function CommercialDisclosure({ value = "", disabled = false }: { value?: string; disabled?: boolean }) {
  return <label className="my-4 block text-sm">Advertising, sponsorship or paid recruitment?
    <select name="commercial_disclosure" required disabled={disabled} defaultValue={value === "unspecified" ? "" : value} className="mt-2 block w-full min-w-0 rounded-xl border bg-white p-3">
      <option value="" disabled>Select a purpose</option>
      <option value="personal">No — personal, non-commercial contribution</option>
      <option value="commercial">Yes — advertising, sponsored or commercial activity</option>
    </select>
    <span className="mt-2 block text-xs leading-5">General contributions appear immediately. Commercial proposals and flagged promotions require review. Product mentions, prices and ordinary YouTube links alone are not advertising. Disguised advertising can be reported.</span>
  </label>;
}
