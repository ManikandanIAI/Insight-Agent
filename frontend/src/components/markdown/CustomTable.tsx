import { useRef } from "react";
import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";


interface CustomTableProps {
    children: any
}

const CustomTable: React.FC<CustomTableProps> = ({ children, ...props }) => {
    const tableRef = useRef<HTMLTableElement>(null);

    const handleDownloadExcel = () => {
        const tableEl = tableRef.current;

        if (tableEl) {
            const headers = Array.from(tableEl.querySelectorAll('th')).map(th =>
                th.textContent?.trim()
            );

            const tableRows = tableEl.querySelectorAll('tbody tr');
            const data = [headers];

            tableRows.forEach(row => {
                const rowData = Array.from(row.querySelectorAll('td')).map(td =>
                    td.textContent?.trim()
                );
                data.push(rowData);
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, "Table Data");
            const now = new Date();
            const formatted = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
            const fileName = `table-data-${formatted}.xlsx`;
            XLSX.writeFile(wb, fileName);
        }
    };

    return (
        <div className="[&:not(:first-child)]:mt-2 [&:not(:last-child)]:mb-2 relative">
            <div className="rounded-md border border-[#D2D2D2] overflow-hidden">
                <Table className="" ref={tableRef} {...(props as any)}>
                    {children}
                </Table>
            </div>


            <div className="flex justify-end">
                <button
                    onClick={handleDownloadExcel}
                    className="mt-2 bg-white text-black py-1.5 gap-x-1 px-[0.935rem] rounded-md flex items-center shadow-[0_0_6px_rgba(0,0,0,0.2)]"
                >
                    <Download className="text-black size-3.5" />
                    <span className="text-xs">Download Excel</span>
                </button>

            </div>
        </div>
    );
}

export default CustomTable;
