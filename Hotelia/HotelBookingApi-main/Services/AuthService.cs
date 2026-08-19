


using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using HotelBookingApi.Data;
using HotelBookingApi.DTOs.Auth;
using HotelBookingApi.Models;
using HotelBookingApi.Models.Enums;

namespace HotelBookingApi.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public AuthService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task<AuthResponseDto> Register(RegisterDto dto)
        {
            // 1. Check if email already exists
            if (await _context.Users.AnyAsync(u => u.Email == dto.Email.ToLower()))
                throw new InvalidOperationException("A user with this email already exists.");

            // 2. Create user with hashed password
            var user = new User
            {
                Name = dto.Name,
                Email = dto.Email.ToLower(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = UserRole.User,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // 3. Return JWT token
            return GenerateAuthResponse(user);
        }

        public async Task<AuthResponseDto> Login(LoginDto dto)
        {
            // 1. Find user
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == dto.Email.ToLower());

            if (user == null)
                throw new UnauthorizedAccessException("Invalid email or password.");

            // 2. Check password
            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                throw new UnauthorizedAccessException("Invalid email or password.");

            // 3. Return JWT token
            return GenerateAuthResponse(user);
        }

        public async Task DeleteAccount(int userId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                    throw new KeyNotFoundException("User not found.");

                // Delete all bookings first (Restrict prevents cascade from DB level)
                var bookings = await _context.Bookings
                    .Where(b => b.UserId == userId)
                    .ToListAsync();
                _context.Bookings.RemoveRange(bookings);

                // Now delete the user
                _context.Users.Remove(user);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private AuthResponseDto GenerateAuthResponse(User user)
        {
            var jwtKey = _config["Jwt:Key"]!;
            var expiryHours = int.Parse(_config["Jwt:ExpiryInHours"] ?? "24");
            var expiresAt = DateTime.UtcNow.AddHours(expiryHours);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.Name),
                new Claim(ClaimTypes.Role, user.Role.ToString())
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: expiresAt,
                signingCredentials: creds
            );

            return new AuthResponseDto
            {
                Token = new JwtSecurityTokenHandler().WriteToken(token),
                Email = user.Email,
                Name = user.Name,
                Role = user.Role.ToString(),
                ExpiresAt = expiresAt,
                CreatedAt = user.CreatedAt
            };
        }
    }
}
