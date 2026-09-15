using HotelBookingApi.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelBookingApi.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260820120000_AddRoomTypeAvailabilityWindow")]
    public partial class AddRoomTypeAvailabilityWindow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "AvailableFrom",
                table: "RoomTypes",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "AvailableTo",
                table: "RoomTypes",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TotalRooms",
                table: "RoomTypes",
                type: "int",
                nullable: false,
                defaultValue: 1);

            // Preserve the current inventory window for room types created before this change.
            migrationBuilder.Sql("""
                UPDATE rt
                SET AvailableFrom = inventoryWindow.AvailableFrom,
                    AvailableTo = inventoryWindow.AvailableTo,
                    TotalRooms = inventoryWindow.TotalRooms
                FROM RoomTypes AS rt
                INNER JOIN (
                    SELECT RoomTypeId,
                           MIN([Date]) AS AvailableFrom,
                           DATEADD(day, 1, MAX([Date])) AS AvailableTo,
                           MAX(TotalRooms) AS TotalRooms
                    FROM RoomInventories
                    GROUP BY RoomTypeId
                ) AS inventoryWindow ON inventoryWindow.RoomTypeId = rt.Id;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "AvailableFrom", table: "RoomTypes");
            migrationBuilder.DropColumn(name: "AvailableTo", table: "RoomTypes");
            migrationBuilder.DropColumn(name: "TotalRooms", table: "RoomTypes");
        }
    }
}
