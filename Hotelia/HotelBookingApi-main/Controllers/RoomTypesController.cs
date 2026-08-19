using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Data;
using HotelBookingApi.DTOs.RoomTypes;
using HotelBookingApi.Models;

namespace HotelBookingApi.Controllers
{
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class RoomTypesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RoomTypesController(AppDbContext context)
        {
            _context = context;
        }

        // POST /api/admin/hotels/{hotelId}/room-types
        [HttpPost("/api/admin/hotels/{hotelId}/room-types")]
        public async Task<ActionResult<RoomTypeResponseDto>> CreateRoomType(int hotelId, CreateRoomTypeDto dto)
        {
            var hotelExists = await _context.Hotels.AnyAsync(h => h.Id == hotelId);
            if (!hotelExists) return NotFound("Hotel not found.");

            var roomType = new RoomType
            {
                HotelId = hotelId,
                Name = dto.Name,
                Capacity = dto.Capacity,
                BedType = dto.BedType,
                BasePrice = dto.BasePrice,
                Description = dto.Description
            };

            _context.RoomTypes.Add(roomType);
            await _context.SaveChangesAsync();

            return Ok(MapToDto(roomType));
        }

        // PUT /api/admin/room-types/{id}
        [HttpPut("/api/admin/room-types/{id}")]
        public async Task<ActionResult<RoomTypeResponseDto>> UpdateRoomType(int id, UpdateRoomTypeDto dto)
        {
            var roomType = await _context.RoomTypes.FindAsync(id);
            if (roomType == null) return NotFound();

            if (dto.Name != null) roomType.Name = dto.Name;
            if (dto.Capacity.HasValue) roomType.Capacity = dto.Capacity.Value;
            if (dto.BedType != null) roomType.BedType = dto.BedType;
            if (dto.BasePrice.HasValue) roomType.BasePrice = dto.BasePrice.Value;
            if (dto.Description != null) roomType.Description = dto.Description;

            await _context.SaveChangesAsync();
            return Ok(MapToDto(roomType));
        }

        // DELETE /api/admin/room-types/{id}
        [HttpDelete("/api/admin/room-types/{id}")]
        public async Task<IActionResult> DeleteRoomType(int id)
        {
            var roomType = await _context.RoomTypes.FindAsync(id);
            if (roomType == null) return NotFound();

            _context.RoomTypes.Remove(roomType);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private static RoomTypeResponseDto MapToDto(RoomType rt) => new()
        {
            Id = rt.Id,
            HotelId = rt.HotelId,
            Name = rt.Name,
            Capacity = rt.Capacity,
            BedType = rt.BedType,
            BasePrice = rt.BasePrice,
            Description = rt.Description
        };
    }
}