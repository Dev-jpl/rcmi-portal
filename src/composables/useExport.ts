import * as XLSX from 'xlsx'

interface SheetDef {
    name: string
    data: Record<string, unknown>[]
}

export function useExport() {
    function exportToExcel(
        data: Record<string, unknown>[],
        filename: string,
        sheetName = 'Sheet1',
    ) {
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
        XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
    }

    function exportMultiSheet(sheets: SheetDef[], filename: string) {
        const wb = XLSX.utils.book_new()
        for (const sheet of sheets) {
            const ws = XLSX.utils.json_to_sheet(sheet.data)
            XLSX.utils.book_append_sheet(wb, ws, sheet.name)
        }
        XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
    }

    return { exportToExcel, exportMultiSheet }
}
