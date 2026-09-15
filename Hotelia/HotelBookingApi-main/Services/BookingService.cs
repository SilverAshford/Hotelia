using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Data;
using HotelBookingApi.DTOs.Bookings;
using HotelBookingApi.Models;
using HotelBookingApi.Models.Enums;

namespace HotelBookingApi.Services
{
    public class BookingService : IBookingService
    {
        private readonly AppDbContext _context;

        public BookingService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// User creates a booking request. Status starts as PENDING.
        /// Inventory is NOT decremented yet — only on confirm.
        /// </summary>
        public async Task<BookingResponseDto> CreateBooking(int userId, CreateBookingDto dto)
        {
            // 1. Validate dates
            if (dto.CheckIn >= dto.CheckOut)
                throw new ArgumentException("Check-in must be before check-out.");

            if (dto.CheckIn < DateOnly.FromDateTime(DateTime.UtcNow))
                throw new ArgumentException("Check-in date cannot be in the past.");

            // 2. Verify hotel and room type exist and match
            var roomType = await _context.RoomTypes
                .Include(rt => rt.Hotel)
                .FirstOrDefaultAsync(rt => rt.Id == dto.RoomTypeId && rt.HotelId == dto.HotelId);

            if (roomType == null)
                throw new ArgumentException("Room type not found or doesn't belong to this hotel.");

            if (dto.Guests > roomType.Capacity)
                throw new ArgumentException($"This room accommodates a maximum of {roomType.Capacity} guest(s).");

            if (roomType.AvailableFrom.HasValue && dto.CheckIn < roomType.AvailableFrom.Value)
                throw new ArgumentException($"Check-in is available from {roomType.AvailableFrom.Value}.");

            if (roomType.AvailableTo.HasValue && dto.CheckOut > roomType.AvailableTo.Value)
                throw new ArgumentException($"Check-out must be on or before {roomType.AvailableTo.Value}.");

            // 3. Check availability for every night
            var nights = dto.CheckOut.DayNumber - dto.CheckIn.DayNumber;
            for (var date = dto.CheckIn; date < dto.CheckOut; date = date.AddDays(1))
            {
                var inventory = await _context.RoomInventories
                    .FirstOrDefaultAsync(ri => ri.RoomTypeId == dto.RoomTypeId && ri.Date == date);

                if (inventory == null || inventory.AvailableRooms <= 0)
                    throw new InvalidOperationException($"No rooms available for {date}.");
            }

            // 4. Create booking
            var booking = new Booking
            {
                UserId = userId,
                HotelId = dto.HotelId,
                RoomTypeId = dto.RoomTypeId,
                CheckIn = dto.CheckIn,
                CheckOut = dto.CheckOut,
                Nights = nights,
                Guests = dto.Guests,
                TotalPrice = nights * roomType.BasePrice,
                Status = BookingStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();

            return MapToDto(booking, roomType.Hotel.Name, roomType.Name,
                (await _context.Users.FindAsync(userId))!.Name);
        }

        /// <summary>
        /// Admin confirms a booking. Decrements inventory inside a transaction.
        /// Re-checks availability to prevent double-booking.
        /// </summary>
        public async Task<BookingResponseDto> ConfirmBooking(int bookingId)
        {
            // Use a transaction — all or nothing
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.User)
                    .Include(b => b.Hotel)
                    .Include(b => b.RoomType)
                    .FirstOrDefaultAsync(b => b.Id == bookingId);

                if (booking == null)
                    throw new ArgumentException("Booking not found.");

                if (booking.Status != BookingStatus.Pending)
                    throw new InvalidOperationException("Only pending bookings can be confirmed.");

                // Re-check availability and increment Booked Rooms for each night
                Console.WriteLine($"=== Confirming Booking {bookingId} ===");
                Console.WriteLine($"Room Type ID: {booking.RoomTypeId}");
                Console.WriteLine($"Check-in: {booking.CheckIn}, Check-out: {booking.CheckOut}");
                
                for (var date = booking.CheckIn; date < booking.CheckOut; date = date.AddDays(1))
                {
                    var inventory = await _context.RoomInventories
                        .FirstOrDefaultAsync(ri => ri.RoomTypeId == booking.RoomTypeId && ri.Date == date);

                    if (inventory == null || inventory.AvailableRooms <= 0)
                    {
                        Console.WriteLine($"❌ No inventory found for {date} or no rooms available");
                        // Rollback — can't confirm
                        await transaction.RollbackAsync();
                        throw new InvalidOperationException(
                            $"No rooms available for {date}. Cannot confirm booking.");
                    }

                    Console.WriteLine($"📅 {date}: Total={inventory.TotalRooms}, Booked={inventory.BookedRooms} (before), Available={inventory.AvailableRooms}");
                    inventory.BookedRooms++;  // Decrement availability
                    Console.WriteLine($"   After increment: Booked={inventory.BookedRooms}, Available={inventory.TotalRooms - inventory.BookedRooms}");
                }

                booking.Status = BookingStatus.Confirmed;
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                
                Console.WriteLine("✅ Booking confirmed successfully!");

                return MapToDto(booking, booking.Hotel.Name, booking.RoomType.Name, booking.User.Name);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error confirming booking: {ex.Message}");
                await transaction.RollbackAsync();
                throw;
            }
        }

        /// <summary>
        /// Admin rejects a pending booking. No inventory changes needed.
        /// </summary>
        public async Task<BookingResponseDto> RejectBooking(int bookingId)
        {
            var booking = await _context.Bookings
                .Include(b => b.User)
                .Include(b => b.Hotel)
                .Include(b => b.RoomType)
                .FirstOrDefaultAsync(b => b.Id == bookingId);

            if (booking == null)
                throw new ArgumentException("Booking not found.");

            if (booking.Status != BookingStatus.Pending)
                throw new InvalidOperationException("Only pending bookings can be rejected.");

            booking.Status = BookingStatus.Rejected;
            await _context.SaveChangesAsync();

            return MapToDto(booking, booking.Hotel.Name, booking.RoomType.Name, booking.User.Name);
        }

        /// <summary>
        /// User cancels a confirmed booking. Restores inventory inside a transaction.
        /// </summary>
        public async Task<BookingResponseDto> CancelBooking(int bookingId, int userId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.User)
                    .Include(b => b.Hotel)
                    .Include(b => b.RoomType)
                    .FirstOrDefaultAsync(b => b.Id == bookingId);

                if (booking == null)
                    throw new ArgumentException("Booking not found.");

                if (booking.UserId != userId)
                    throw new UnauthorizedAccessException("You can only cancel your own bookings.");

                if (booking.Status != BookingStatus.Confirmed)
                    throw new InvalidOperationException("Only confirmed bookings can be cancelled.");

                // Restore inventory for each night
                for (var date = booking.CheckIn; date < booking.CheckOut; date = date.AddDays(1))
                {
                    var inventory = await _context.RoomInventories
                        .FirstOrDefaultAsync(ri => ri.RoomTypeId == booking.RoomTypeId && ri.Date == date);

                    if (inventory != null && inventory.BookedRooms > 0)
                        inventory.BookedRooms--;  // Give the room back
                }

                booking.Status = BookingStatus.Cancelled;
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return MapToDto(booking, booking.Hotel.Name, booking.RoomType.Name, booking.User.Name);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        /// <summary>
        /// Admin cancels any booking (Pending or Confirmed).
        /// If Confirmed → restore inventory. If Pending → just mark Cancelled.
        /// </summary>
        public async Task<BookingResponseDto> AdminCancelBooking(int bookingId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.User)
                    .Include(b => b.Hotel)
                    .Include(b => b.RoomType)
                    .FirstOrDefaultAsync(b => b.Id == bookingId);

                if (booking == null)
                    throw new ArgumentException("Booking not found.");

                if (booking.Status == BookingStatus.Cancelled || booking.Status == BookingStatus.Completed)
                    throw new InvalidOperationException("Booking is already closed.");

                // If Confirmed, restore inventory
                if (booking.Status == BookingStatus.Confirmed)
                {
                    for (var date = booking.CheckIn; date < booking.CheckOut; date = date.AddDays(1))
                    {
                        var inventory = await _context.RoomInventories
                            .FirstOrDefaultAsync(ri => ri.RoomTypeId == booking.RoomTypeId && ri.Date == date);

                        if (inventory != null && inventory.BookedRooms > 0)
                            inventory.BookedRooms--;
                    }
                }

                booking.Status = BookingStatus.Cancelled;
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return MapToDto(booking, booking.Hotel.Name, booking.RoomType.Name, booking.User.Name);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        /// <summary>
        /// Mark a Confirmed booking as Completed (check-out date has passed).
        /// </summary>
        public async Task<BookingResponseDto> CompleteBooking(int bookingId)
        {
            var booking = await _context.Bookings
                .Include(b => b.User)
                .Include(b => b.Hotel)
                .Include(b => b.RoomType)
                .FirstOrDefaultAsync(b => b.Id == bookingId);

            if (booking == null)
                throw new ArgumentException("Booking not found.");

            if (booking.Status != BookingStatus.Confirmed)
                throw new InvalidOperationException("Only confirmed bookings can be marked as completed.");

            if (booking.CheckOut > DateOnly.FromDateTime(DateTime.UtcNow))
                throw new InvalidOperationException("Check-out date has not passed yet.");

            booking.Status = BookingStatus.Completed;
            await _context.SaveChangesAsync();

            return MapToDto(booking, booking.Hotel.Name, booking.RoomType.Name, booking.User.Name);
        }

        /// <summary>
        /// Helper: converts a Booking entity into a BookingResponseDto.
        /// </summary>
        private static BookingResponseDto MapToDto(
            Booking booking, string hotelName, string roomTypeName, string userName)
        {
            return new BookingResponseDto
            {
                Id = booking.Id,
                UserId = booking.UserId,
                UserName = userName,
                HotelId = booking.HotelId,
                HotelName = hotelName,
                RoomTypeId = booking.RoomTypeId,
                RoomTypeName = roomTypeName,
                CheckIn = booking.CheckIn,
                CheckOut = booking.CheckOut,
                Nights = booking.Nights,
                Guests = booking.Guests,
                TotalPrice = booking.TotalPrice,
                Status = booking.Status.ToString(),
                CreatedAt = booking.CreatedAt
            };
        }
    }
}
