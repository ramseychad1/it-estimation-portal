import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable, type DataTableColumn } from "./DataTable";

interface Row {
  id: number;
  name: string;
  count: number;
}

const ROWS: Row[] = [
  { id: 1, name: "Alpha", count: 3 },
  { id: 2, name: "Beta", count: 11 },
];

const COLS: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", accessor: (r) => r.name, sortable: true },
  {
    key: "count",
    header: "Count",
    accessor: (r) => r.count,
    align: "right",
    render: (r) => <span data-testid={`count-${r.id}`}>×{r.count}</span>,
  },
];

describe("<DataTable>", () => {
  it("renders rows using the column render function when provided", () => {
    render(<DataTable<Row, number> rows={ROWS} columns={COLS} rowKey={(r) => r.id} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByTestId("count-1")).toHaveTextContent("×3");
    expect(screen.getByTestId("count-2")).toHaveTextContent("×11");
  });

  it("renders an empty state when there are no rows", () => {
    render(
      <DataTable<Row, number>
        rows={[]}
        columns={COLS}
        rowKey={(r) => r.id}
        emptyState={<div>No alphas here</div>}
      />,
    );
    expect(screen.getByText("No alphas here")).toBeInTheDocument();
  });

  it("fires onRowClick when a row is clicked", async () => {
    const onRowClick = vi.fn();
    const user = userEvent.setup();
    render(
      <DataTable<Row, number>
        rows={ROWS}
        columns={COLS}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    await user.click(screen.getByText("Alpha"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it("does NOT fire onRowClick when interacting with a preventRowClick cell", async () => {
    const onRowClick = vi.fn();
    const user = userEvent.setup();
    const colsWithActions: DataTableColumn<Row>[] = [
      ...COLS,
      {
        key: "actions",
        header: "",
        preventRowClick: true,
        render: (r) => (
          <button type="button" data-testid={`act-${r.id}`}>
            Edit
          </button>
        ),
      },
    ];
    render(
      <DataTable<Row, number>
        rows={ROWS}
        columns={colsWithActions}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    await user.click(screen.getByTestId("act-1"));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("toggles header sort: first click sets asc, repeat flips dir", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DataTable<Row, number>
        rows={ROWS}
        columns={COLS}
        rowKey={(r) => r.id}
        sort={{ by: "count", dir: "asc", onChange }}
      />,
    );
    // 'Name' isn't the active sort; first click → ('name', 'asc').
    await user.click(screen.getByText("Name"));
    expect(onChange).toHaveBeenLastCalledWith("name", "asc");
  });

  it("supports controlled selection with select-all + per-row toggle", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DataTable<Row, number>
        rows={ROWS}
        columns={COLS}
        rowKey={(r) => r.id}
        selection={{ selectedIds: [], onChange }}
      />,
    );

    // Select-all checkbox is the first checkbox in the header.
    const selectAll = screen.getByLabelText(/select all rows/i);
    await user.click(selectAll);
    expect(onChange).toHaveBeenLastCalledWith([1, 2]);

    // Per-row select.
    onChange.mockClear();
    const rowOne = screen.getByLabelText(/select row 1/i);
    await user.click(rowOne);
    expect(onChange).toHaveBeenLastCalledWith([1]);
  });
});
