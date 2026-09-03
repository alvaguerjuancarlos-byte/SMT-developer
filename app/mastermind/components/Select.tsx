'use client'

const selectCls = 'w-full text-[13px] border border-white/15 rounded-xl px-3 py-2.5 bg-black/30 text-white focus:outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]'

export default function Select({
  label,
  value,
  onChange,
  options,
  colSpan = 2,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  colSpan?: 1 | 2
}) {
  return (
    <div className={colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
      <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">{label}</label>
      <select className={selectCls} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v} className="bg-[#070f22] text-white">{l}</option>)}
      </select>
    </div>
  )
}
